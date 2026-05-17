import { Router, type Response } from 'express'
import { requireAuth, type AuthRequest } from '../../middleware/auth'
import type { AiService } from './ai.service'

export function createAiRouter(service: AiService) {
  const router = Router()

  // List providers
  router.get('/providers', (_req, res) => {
    res.json(service.listProviders())
  })

  // Platform generation (uses credits)
  router.post('/generate', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const result = await service.startGeneration(req.userId!, req.body as any)
      res.json(result)
    } catch (err: any) {
      if (err.statusCode === 400) return res.status(400).json({ error: err.message })
      if (err.statusCode === 403) return res.status(403).json({ error: err.message })
      throw err
    }
  })

  // Custom API generation (no credits)
  router.post('/generate-custom', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const result = await service.startCustomGeneration(req.userId!, req.body as any)
      res.json(result)
    } catch (err: any) {
      if (err.statusCode === 400) return res.status(400).json({ error: err.message })
      throw err
    }
  })

  // List tasks
  router.get('/tasks', requireAuth, async (req: AuthRequest, res: Response) => {
    const tasks = await service.getTasks(req.userId!)
    res.json(tasks)
  })

  // Get task detail
  router.get('/tasks/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const task = await service.getTaskDetail(req.params.id!, req.userId!)
      res.json(task)
    } catch (err: any) {
      if (err.statusCode === 404) return res.status(404).json({ error: err.message })
      throw err
    }
  })

  // Cancel task
  router.post('/tasks/:id/cancel', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const result = await service.cancelTask(req.params.id!, req.userId!)
      res.json(result)
    } catch (err: any) {
      if (err.statusCode === 400) return res.status(400).json({ error: err.message })
      if (err.statusCode === 404) return res.status(404).json({ error: err.message })
      throw err
    }
  })

  // Delete task
  router.delete('/tasks/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const result = await service.deleteTask(req.params.id!, req.userId!)
      res.json(result)
    } catch (err: any) {
      if (err.statusCode === 400) return res.status(400).json({ error: err.message })
      if (err.statusCode === 404) return res.status(404).json({ error: err.message })
      throw err
    }
  })

  // Regenerate task (re-submits with same params)
  router.post('/tasks/:id/regenerate', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const task = await service.getTaskDetail(req.params.id!, req.userId!)
      if (task.status === 'generating') return res.status(400).json({ error: '任务正在生成中' })

      const inputParams = task.inputParams as any

      if (inputParams.textConfig) {
        // Custom mode — re-read latest API key from config
        const result = await service.startCustomGeneration(req.userId!, {
          synopsis: inputParams.synopsis,
          style: inputParams.style,
          type: inputParams.type,
          pageCount: inputParams.pageCount,
          textConfig: { baseUrl: inputParams.textConfig.baseUrl, apiKey: '', model: inputParams.textConfig.model },
          imageConfig: inputParams.imageConfig ? { baseUrl: inputParams.imageConfig.baseUrl, apiKey: '', model: inputParams.imageConfig.model } : undefined,
        })
        res.json(result)
      } else {
        // Platform mode
        const result = await service.startGeneration(req.userId!, {
          synopsis: inputParams.synopsis,
          style: inputParams.style,
          type: inputParams.type,
          pageCount: inputParams.pageCount,
          textProvider: inputParams.textProvider,
          imageProvider: inputParams.imageProvider,
        })
        res.json(result)
      }
    } catch (err: any) {
      if (err.statusCode === 400) return res.status(400).json({ error: err.message })
      if (err.statusCode === 403) return res.status(403).json({ error: err.message })
      if (err.statusCode === 404) return res.status(404).json({ error: err.message })
      throw err
    }
  })

  // Generate cover image
  router.post('/generate-cover', requireAuth, async (req: AuthRequest, res: Response) => {
    const { coverPrompt, provider, style, customConfig } = req.body as any
    if (!coverPrompt) return res.status(400).json({ error: '缺少封面提示词' })

    try {
      let imageUrl: string | undefined

      if (customConfig?.baseUrl && customConfig?.apiKey && customConfig?.model) {
        const url = `${customConfig.baseUrl}/images/generations`
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${customConfig.apiKey}` },
          body: JSON.stringify({ model: customConfig.model, prompt: coverPrompt, size: '1024x1024', n: 1 }),
        })
        if (resp.ok) {
          const data = await resp.json() as any
          const remoteUrl = data?.data?.[0]?.url || data?.data?.[0]?.b64_json
          if (remoteUrl) {
            const { downloadAndSaveImage } = await import('../../ai/storage')
            imageUrl = await downloadAndSaveImage(remoteUrl)
          }
        }
      } else if (provider) {
        const { registry } = await import('../../ai')
        const imageP = registry.getImageProvider(provider)
        if (!imageP) return res.status(400).json({ error: `未知的图片 Provider: ${provider}` })
        const result = await imageP.generateImage({ prompt: coverPrompt, style: style || '', size: '1024x1024' })
        if (result.success) imageUrl = result.imageUrl
      } else {
        return res.status(400).json({ error: '需要指定 provider 或 customConfig' })
      }

      if (!imageUrl) return res.status(500).json({ error: '封面生成失败' })
      res.json({ cover_image: imageUrl })
    } catch (err: any) {
      res.status(500).json({ error: err.message || '封面生成失败' })
    }
  })

  // Generate single page image
  router.post('/generate-page', requireAuth, async (req: AuthRequest, res: Response) => {
    const { provider, style, type, imagePrompt, dialogue } = req.body as any
    if (!provider || !style || !imagePrompt) return res.status(400).json({ error: '缺少必要参数' })

    const { registry } = await import('../../ai')
    const imageP = registry.getImageProvider(provider)
    if (!imageP) return res.status(400).json({ error: `未知的图片 Provider: ${provider}` })

    try {
      const { buildImagePrompt } = await import('../../ai/prompts')
      const prompt = buildImagePrompt({ pageNumber: 1, description: '', dialogue: dialogue || '', imagePrompt }, style, type || 'comic')
      const result = await imageP.generateImage({ prompt, style, size: '1024x1024' })

      if (!result.success) return res.status(500).json({ error: result.error || '图片生成失败' })
      res.json({ image_url: result.imageUrl, ai_generated: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message || '图片生成失败' })
    }
  })

  // Get config
  router.get('/config', requireAuth, async (req: AuthRequest, res: Response) => {
    const config = await service.getConfig(req.userId!)
    res.json(config)
  })

  // Save config
  router.put('/config', requireAuth, async (req: AuthRequest, res: Response) => {
    const result = await service.saveConfig(req.userId!, req.body as any)
    res.json(result)
  })

  return router
}
