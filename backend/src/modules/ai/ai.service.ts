import { ValidationError, ForbiddenError, NotFoundError } from '../../shared/errors'
import { registry } from '../../ai'
import { buildImagePrompt } from '../../ai/prompts'
import { calculateCredits, estimateMaxCredits } from '../../pricingConfig'
import type { AiRepository } from './ai.repository'

// In-memory abort controllers for running tasks
const taskAbortMap = new Map<string, AbortController>()

export class AiService {
  constructor(private repo: AiRepository) {}

  // ============ Providers ============

  listProviders() {
    return {
      textProviders: registry.listTextProviders(),
      imageProviders: registry.listImageProviders(),
    }
  }

  // ============ Generation ============

  async startGeneration(userId: string, params: {
    synopsis: string; style: string; type: string; pageCount: number;
    textProvider: string; imageProvider?: string;
    parentWorkId?: string; forkFromPage?: number;
  }) {
    const { synopsis, style, type, pageCount, textProvider, imageProvider } = params
    if (!synopsis || !style || !type || !pageCount || !textProvider || (type !== 'novel' && !imageProvider)) {
      throw new ValidationError('缺少必要参数')
    }

    // Credit check
    const hasImages = type !== 'novel'
    const estimatedCost = estimateMaxCredits(pageCount, hasImages)
    const credits = await this.repo.getUserCredits(userId)
    if (credits === undefined || credits < estimatedCost) {
      throw new ForbiddenError(`积分可能不足，预估需要${estimatedCost}积分，当前${credits || 0}积分`)
    }

    const textP = registry.getTextProvider(textProvider)
    const imageP = registry.getImageProvider(imageProvider || '')
    if (!textP) throw new ValidationError(`未知的文字 Provider: ${textProvider}`)
    if (type !== 'novel' && !imageP) throw new ValidationError(`未知的图片 Provider: ${imageProvider}`)

    const inputParams = { synopsis, style, type, pageCount, textProvider, imageProvider, parentWorkId: params.parentWorkId, forkFromPage: params.forkFromPage }
    const task = await this.repo.createTask({ userId, type, inputParams })

    // Run async generation
    this.runGeneration(task.id, userId, params, textP, imageP)

    return { taskId: task.id, message: '创作任务已提交，可在个人页查看进度' }
  }

  async startCustomGeneration(userId: string, params: {
    synopsis: string; style: string; type: string; pageCount: number;
    textConfig: { baseUrl: string; apiKey: string; model: string };
    imageConfig?: { baseUrl: string; apiKey: string; model: string };
    parentWorkId?: string; forkFromPage?: number;
  }) {
    const { synopsis, style, type, pageCount, textConfig, imageConfig } = params
    if (!synopsis || !style || !type || !pageCount || !textConfig) {
      throw new ValidationError('缺少必要参数')
    }
    if (!textConfig.baseUrl || !textConfig.apiKey || !textConfig.model) {
      throw new ValidationError('文字模型配置不完整')
    }
    if (type !== 'novel' && (!imageConfig || !imageConfig.baseUrl || !imageConfig.apiKey || !imageConfig.model)) {
      throw new ValidationError('图片模型配置不完整')
    }

    const inputParams = {
      synopsis, style, type, pageCount,
      textConfig: { baseUrl: textConfig.baseUrl, model: textConfig.model },
      imageConfig: imageConfig ? { baseUrl: imageConfig.baseUrl, model: imageConfig.model } : null,
      parentWorkId: params.parentWorkId, forkFromPage: params.forkFromPage,
    }
    const task = await this.repo.createTask({ userId, type, inputParams })

    this.runCustomGeneration(task.id, userId, params)

    return { taskId: task.id, message: '创作任务已提交，可在个人页查看进度' }
  }

  // ============ Tasks ============

  async getTasks(userId: string) {
    return this.repo.getUserTasks(userId)
  }

  async getTaskDetail(id: string, userId: string) {
    const task = await this.repo.getTaskById(id, userId)
    if (!task) throw new NotFoundError('任务不存在')
    return task
  }

  async cancelTask(id: string, userId: string) {
    const task = await this.repo.getTaskById(id, userId)
    if (!task) throw new NotFoundError('任务不存在')
    if (task.status !== 'generating') throw new ValidationError('只能取消生成中的任务')

    await this.repo.updateTask(id, { status: 'cancelled', completedAt: new Date() })
    const controller = taskAbortMap.get(id)
    if (controller) controller.abort()

    return { message: '任务已取消' }
  }

  async deleteTask(id: string, userId: string) {
    const task = await this.repo.getTaskById(id, userId)
    if (!task) throw new NotFoundError('任务不存在')
    if (task.status === 'generating') throw new ValidationError('生成中的任务请先取消')

    await this.repo.deleteTask(id)
    return { message: '任务已删除' }
  }

  // ============ Config ============

  async getConfig(userId: string) {
    const config = await this.repo.getConfig(userId)
    if (!config) {
      return { text_base_url: '', text_api_key: '', text_model: '', image_base_url: '', image_api_key: '', image_model: '' }
    }
    // Don't expose full API key
    return {
      text_base_url: config.textBaseUrl || '',
      text_api_key: config.textApiKey ? `${config.textApiKey.slice(0, 4)}****` : '',
      text_model: config.textModel || '',
      image_base_url: config.imageBaseUrl || '',
      image_api_key: config.imageApiKey ? `${config.imageApiKey.slice(0, 4)}****` : '',
      image_model: config.imageModel || '',
    }
  }

  async saveConfig(userId: string, data: {
    text_base_url?: string; text_api_key?: string; text_model?: string;
    image_base_url?: string; image_api_key?: string; image_model?: string;
  }) {
    // If api_key is masked (contains ****), keep the old one
    const existing = await this.repo.getConfig(userId)
    const resolved = {
      textBaseUrl: data.text_base_url || '',
      textApiKey: data.text_api_key?.includes('****') ? (existing?.textApiKey || '') : (data.text_api_key || ''),
      textModel: data.text_model || '',
      imageBaseUrl: data.image_base_url || '',
      imageApiKey: data.image_api_key?.includes('****') ? (existing?.imageApiKey || '') : (data.image_api_key || ''),
      imageModel: data.image_model || '',
    }
    await this.repo.upsertConfig(userId, resolved)
    return { message: '配置已保存' }
  }

  // ============ Private: Async Generation ============

  private runGeneration(taskId: string, userId: string, params: any, textP: any, imageP: any) {
    const abortController = new AbortController()
    taskAbortMap.set(taskId, abortController)
    const { synopsis, style, type, pageCount, textProvider, imageProvider } = params
    const typeLabel = type === 'novel' ? '小说' : type === 'comic' ? '漫画' : '短剧'

    ;(async () => {
      let usedPromptTokens = 0, usedCompletionTokens = 0, imageCount = 0

      try {
        const textResult = await textP.generateBreakdown({ synopsis, style, pageCount, type })
        if (abortController.signal.aborted) {
          usedPromptTokens = textResult.usage?.promptTokens || 0
          usedCompletionTokens = textResult.usage?.completionTokens || 0
          throw new DOMException('Aborted', 'AbortError')
        }
        if (!textResult.success) {
          await this.repo.updateTask(taskId, { status: 'failed', error: textResult.error || '文字生成失败', completedAt: new Date() })
          return
        }

        usedPromptTokens = textResult.usage?.promptTokens || 0
        usedCompletionTokens = textResult.usage?.completionTokens || 0

        const pages = []
        for (const page of textResult.pages) {
          if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError')
          if (type === 'novel') {
            pages.push({ pageNumber: page.pageNumber, description: page.description, dialogue: page.dialogue, image_url: undefined, ai_generated: true })
          } else {
            const imagePrompt = buildImagePrompt(page, style, type)
            const imageResult = await imageP!.generateImage({ prompt: imagePrompt, style, size: '2K' })
            if (imageResult.success) imageCount++
            pages.push({ pageNumber: page.pageNumber, description: page.description, dialogue: page.dialogue, image_url: imageResult.success ? imageResult.imageUrl : undefined, ai_generated: true })
          }
        }

        const finalImageCount = pages.filter((p: any) => p.image_url).length
        const actualCredits = calculateCredits({ promptTokens: usedPromptTokens, completionTokens: usedCompletionTokens, imageCount: finalImageCount })

        await this.repo.deductCredits(userId, actualCredits)
        await this.repo.createCreditLog({ userId, amount: -actualCredits, type: 'ai_generate', description: `AI生成${typeLabel}${pageCount}${type === 'novel' ? '章' : '页'}`, taskId })

        const result = { title: textResult.title, description: textResult.description, hookDescription: textResult.hookDescription, coverPrompt: textResult.coverPrompt, pages }
        await this.repo.updateTask(taskId, { status: 'completed', result, creditsUsed: actualCredits, completedAt: new Date() })

        console.log(`[任务${taskId.slice(0, 8)}] 完成，扣费${actualCredits}积分`)
      } catch (err: any) {
        if (err.name === 'AbortError' || abortController.signal.aborted) {
          const partialCredits = calculateCredits({ promptTokens: usedPromptTokens, completionTokens: usedCompletionTokens, imageCount })
          if (partialCredits > 0) {
            await this.repo.deductCredits(userId, partialCredits)
            await this.repo.createCreditLog({ userId, amount: -partialCredits, type: 'ai_generate', description: `AI生成${typeLabel}(已取消，部分消耗)`, taskId })
            await this.repo.updateTask(taskId, { creditsUsed: partialCredits })
          }
          console.log(`[任务${taskId.slice(0, 8)}] 已取消，部分扣费${partialCredits}积分`)
        } else {
          console.error(`[任务${taskId.slice(0, 8)}] 失败:`, err.message)
          await this.repo.updateTask(taskId, { status: 'failed', error: err.message || 'AI 生成失败', completedAt: new Date() })
        }
      } finally {
        taskAbortMap.delete(taskId)
      }
    })()
  }

  private runCustomGeneration(taskId: string, userId: string, params: any) {
    const abortController = new AbortController()
    taskAbortMap.set(taskId, abortController)
    const { synopsis, style, type, pageCount, textConfig, imageConfig } = params

    ;(async () => {
      try {
        // Dynamic import to avoid circular deps
        const { VolcengineTextProvider } = await import('../../ai/providers/volcengine')
        const textP = new VolcengineTextProvider({ apiKey: textConfig.apiKey, baseUrl: textConfig.baseUrl, model: textConfig.model })
        const textResult = await textP.generateBreakdown({ synopsis, style, pageCount, type })

        if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError')
        if (!textResult.success) {
          await this.repo.updateTask(taskId, { status: 'failed', error: textResult.error || '文字生成失败', completedAt: new Date() })
          return
        }

        const pages = []
        if (type === 'novel') {
          for (const page of textResult.pages) {
            pages.push({ pageNumber: page.pageNumber, description: page.description, dialogue: page.dialogue, ai_generated: true })
          }
        } else if (imageConfig) {
          for (const page of textResult.pages) {
            if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError')
            const imagePrompt = buildImagePrompt(page, style, type)
            let imageUrl: string | undefined
            try {
              const url = `${imageConfig.baseUrl}/images/generations`
              const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${imageConfig.apiKey}` },
                body: JSON.stringify({ model: imageConfig.model, prompt: imagePrompt, size: '1024x1024', n: 1 }),
                signal: abortController.signal,
              })
              if (resp.ok) {
                const data = await resp.json() as any
                const remoteUrl = data?.data?.[0]?.url || data?.data?.[0]?.b64_json
                if (remoteUrl) {
                  const { downloadAndSaveImage } = await import('../../ai/storage')
                  imageUrl = await downloadAndSaveImage(remoteUrl)
                }
              }
            } catch (e: any) { if (e.name === 'AbortError') throw e }
            pages.push({ pageNumber: page.pageNumber, description: page.description, dialogue: page.dialogue, image_url: imageUrl, ai_generated: true })
          }
        }

        const result = { title: textResult.title, description: textResult.description, hookDescription: textResult.hookDescription, coverPrompt: textResult.coverPrompt, pages }
        await this.repo.updateTask(taskId, { status: 'completed', result, creditsUsed: 0, completedAt: new Date() })
        console.log(`[任务${taskId.slice(0, 8)}] 自定义API生成完成`)
      } catch (err: any) {
        if (err.name === 'AbortError' || abortController.signal.aborted) {
          console.log(`[任务${taskId.slice(0, 8)}] 自定义API任务已取消`)
        } else {
          console.error(`[任务${taskId.slice(0, 8)}] 自定义API失败:`, err.message)
          await this.repo.updateTask(taskId, { status: 'failed', error: err.message || 'AI 生成失败，请检查 API 配置', completedAt: new Date() })
        }
      } finally {
        taskAbortMap.delete(taskId)
      }
    })()
  }
}
