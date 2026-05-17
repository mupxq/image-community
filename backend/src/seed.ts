import bcrypt from 'bcryptjs'
import { db } from './db/client'
import { users, works, workPages, contributors, comments, bookmarks, conversations, conversationMembers, messages } from './db/schema'
import { eq, sql } from 'drizzle-orm'

const DEFAULT_PASSWORD = '123456'

const seedUsers = [
  { username: 'starcreator', nickname: '星辰画手', avatar: '🎨', bio: '喜欢画漫画的自由创作者' },
  { username: 'lighthunter', nickname: '光影猎人', avatar: '📷', bio: '摄影爱好者，擅长风光和人文' },
  { username: 'storyweaver', nickname: '故事编织者', avatar: '✍️', bio: '脑洞大开的剧情创作者' },
  { username: 'pixeltraveler', nickname: '像素旅人', avatar: '🎮', bio: 'AI绘图玩家，像素风爱好者' },
  { username: 'inkbreeze', nickname: '墨染清风', avatar: '🖌️', bio: '国风插画师，水墨风格' },
]

interface SeedPage { description: string; dialogue: string }

export default async function seedData(): Promise<void> {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(users)
  if (row.count > 0) {
    console.log('数据库已有数据，跳过初始化')
    return
  }

  console.log('开始初始化预置数据...')
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  // Create users
  const userIds: string[] = []
  for (const u of seedUsers) {
    const [inserted] = await db.insert(users).values({
      username: u.username,
      passwordHash,
      nickname: u.nickname,
      avatar: u.avatar,
      bio: u.bio,
    }).returning({ id: users.id })
    userIds.push(inserted.id)
  }

  // Helper: create work with pages and contributor
  async function createWork(data: {
    title: string; description: string; type: 'comic' | 'drama';
    creatorIdx: number; parentWorkId?: string; rootWorkId?: string;
    pages: SeedPage[];
  }) {
    const [work] = await db.insert(works).values({
      title: data.title,
      description: data.description,
      type: data.type,
      creatorId: userIds[data.creatorIdx]!,
      parentWorkId: data.parentWorkId ?? null,
      rootWorkId: data.rootWorkId ?? null,
      status: 'published',
    }).returning()

    if (!data.parentWorkId) {
      await db.update(works).set({ rootWorkId: work.id }).where(eq(works.id, work.id))
    }

    for (let i = 0; i < data.pages.length; i++) {
      const page = data.pages[i]!
      await db.insert(workPages).values({
        workId: work.id,
        pageNumber: i + 1,
        description: page.description,
        dialogue: page.dialogue,
      })
    }

    await db.insert(contributors).values({
      workId: work.id,
      userId: userIds[data.creatorIdx]!,
      role: 'creator',
    })

    return work.id
  }

  // Comic works (creation tree: cyberpunk)
  const cyberRoot = await createWork({
    title: '赛博朋克：霓虹之下',
    description: '2099年，新东京的地下城中，一个普通的快递员发现了改变世界的秘密...',
    type: 'comic', creatorIdx: 0,
    pages: [
      { description: '新东京全景，霓虹灯照亮了整个天际线', dialogue: '' },
      { description: '主角小林骑着飞行摩托穿梭在高楼之间', dialogue: '又是忙碌的一天...' },
      { description: '小林收到一个神秘包裹，上面写着"不要打开"', dialogue: '这个包裹...好沉' },
    ],
  })

  const cyberShadow = await createWork({
    title: '赛博朋克：霓虹之下 - 暗影分支',
    description: '小林打开了包裹，里面是一个神经接口芯片...',
    type: 'comic', creatorIdx: 1, parentWorkId: cyberRoot, rootWorkId: cyberRoot,
    pages: [
      { description: '小林犹豫再三，还是打开了包裹', dialogue: '对不起，我实在太好奇了' },
      { description: '一个闪烁着蓝光的芯片躺在盒子里', dialogue: '这是...神经接口芯片？！' },
      { description: '小林将芯片插入颈部接口，眼前出现了虚拟世界', dialogue: '我能看到...另一个世界' },
    ],
  })

  const cyberJustice = await createWork({
    title: '赛博朋克：霓虹之下 - 正义之路',
    description: '小林没有打开包裹，而是选择交给地下城的反抗军...',
    type: 'comic', creatorIdx: 2, parentWorkId: cyberRoot, rootWorkId: cyberRoot,
    pages: [
      { description: '小林拿着包裹来到反抗军的秘密基地', dialogue: '我觉得这个东西不简单' },
      { description: '反抗军首领检查包裹后大惊失色', dialogue: '这是...传说中的"创世代码"！' },
    ],
  })

  await createWork({
    title: '赛博朋克：暗影分支 - 虚拟觉醒',
    description: '在虚拟世界中，小林遇到了AI导师...',
    type: 'comic', creatorIdx: 3, parentWorkId: cyberShadow, rootWorkId: cyberRoot,
    pages: [
      { description: '虚拟世界中，一个由数据流构成的人形出现', dialogue: '欢迎来到真实的世界，小林' },
      { description: '小林发现自己拥有了操控数据的能力', dialogue: '这种力量...太不可思议了' },
    ],
  })

  // Ancestor contributors for cyber tree
  await db.insert(contributors).values([
    { workId: cyberShadow, userId: userIds[0]!, role: 'ancestor' },
    { workId: cyberJustice, userId: userIds[0]!, role: 'ancestor' },
  ])

  // Drama works (creation tree: parallel café)
  const cafeRoot = await createWork({
    title: '平行咖啡馆',
    description: '每天早上8点，当咖啡馆的门铃响起，时间就会分裂成两条线...',
    type: 'drama', creatorIdx: 4,
    pages: [
      { description: '一家复古风格的咖啡馆，门口挂着"平行"的招牌', dialogue: '' },
      { description: '女主角推开门，门铃叮当作响', dialogue: '老板，一杯拿铁' },
      { description: '时钟指向8:00，画面开始分裂成两半', dialogue: '（旁白）从这一刻起，一切都不同了' },
    ],
  })

  const cafeLeft = await createWork({
    title: '平行咖啡馆 - 左边的世界',
    description: '在这条时间线里，她遇到了童年好友...',
    type: 'drama', creatorIdx: 0, parentWorkId: cafeRoot, rootWorkId: cafeRoot,
    pages: [
      { description: '她在角落看到了一个熟悉的身影', dialogue: '小雨？！你不是去了国外吗？' },
      { description: '两人相拥而泣', dialogue: '我回来了，再也不走了' },
    ],
  })

  const cafeRight = await createWork({
    title: '平行咖啡馆 - 右边的世界',
    description: '在另一条时间线里，咖啡馆根本不存在...',
    type: 'drama', creatorIdx: 2, parentWorkId: cafeRoot, rootWorkId: cafeRoot,
    pages: [
      { description: '她推开门，发现这里变成了一片废墟', dialogue: '这...这是怎么回事？' },
      { description: '废墟中间立着一块石碑："此地已于2020年拆除"', dialogue: '不可能...我明明刚才还...' },
    ],
  })

  await db.insert(contributors).values([
    { workId: cafeLeft, userId: userIds[4]!, role: 'ancestor' },
    { workId: cafeRight, userId: userIds[4]!, role: 'ancestor' },
  ])

  // Comments
  const commentData = [
    { workId: cyberRoot, userIdx: 1, content: '画风太棒了！赛博朋克的感觉拉满' },
    { workId: cyberRoot, userIdx: 2, content: '这个设定好有意思，我想续写一个新分支' },
    { workId: cyberShadow, userIdx: 0, content: '没想到你把小林的故事往这个方向发展了，很惊喜！' },
    { workId: cyberShadow, userIdx: 3, content: '虚拟世界的概念很酷，我来接着写' },
    { workId: cafeRoot, userIdx: 0, content: '时间分裂的设定好浪漫' },
    { workId: cafeRoot, userIdx: 1, content: '这个咖啡馆我想去坐坐' },
  ]
  await db.insert(comments).values(commentData.map(c => ({
    workId: c.workId,
    userId: userIds[c.userIdx]!,
    content: c.content,
  })))

  // Bookmarks
  const bookmarkData = [
    { userIdx: 0, workId: cafeRoot, readStatus: 'reading' as const, lastReadPage: 2 },
    { userIdx: 0, workId: cyberShadow, readStatus: 'finished' as const, lastReadPage: 3 },
    { userIdx: 1, workId: cyberRoot, readStatus: 'reading' as const, lastReadPage: 2 },
    { userIdx: 2, workId: cyberShadow, readStatus: 'finished' as const, lastReadPage: 3 },
  ]
  await db.insert(bookmarks).values(bookmarkData.map(b => ({
    userId: userIds[b.userIdx]!,
    workId: b.workId,
    readStatus: b.readStatus,
    lastReadPage: b.lastReadPage,
  })))

  // Conversations and messages
  // Conv 1: starcreator <-> lighthunter
  const [conv1] = await db.insert(conversations).values({ type: 'private' }).returning()
  await db.insert(conversationMembers).values([
    { conversationId: conv1.id, userId: userIds[0]! },
    { conversationId: conv1.id, userId: userIds[1]! },
  ])
  const msgs1 = [
    { senderIdx: 1, content: '你的赛博朋克画风太赞了！能教我吗？' },
    { senderIdx: 0, content: '谢谢！其实主要是AI辅助的，选对风格就行' },
    { senderIdx: 1, content: '那我们可以一起共创一个新故事吗？' },
    { senderIdx: 0, content: '当然可以！你有什么想法？' },
    { senderIdx: 1, content: '我想做一个末日废土风格的，主角是个摄影师' },
  ]
  await db.insert(messages).values(msgs1.map(m => ({
    conversationId: conv1.id,
    senderId: userIds[m.senderIdx]!,
    content: m.content,
    msgType: 'text' as const,
  })))

  // Conv 2: starcreator <-> storyweaver
  const [conv2] = await db.insert(conversations).values({ type: 'private' }).returning()
  await db.insert(conversationMembers).values([
    { conversationId: conv2.id, userId: userIds[0]! },
    { conversationId: conv2.id, userId: userIds[2]! },
  ])
  const msgs2 = [
    { senderIdx: 2, content: '我续写了你的赛博朋克，正义之路那条线' },
    { senderIdx: 0, content: '看到了！反抗军的设定很有意思' },
    { senderIdx: 2, content: '后面我想让小林加入反抗军，你觉得呢？' },
  ]
  await db.insert(messages).values(msgs2.map(m => ({
    conversationId: conv2.id,
    senderId: userIds[m.senderIdx]!,
    content: m.content,
    msgType: 'text' as const,
  })))

  // Conv 3: group - cyberpunk creation team
  const [conv3] = await db.insert(conversations).values({ type: 'group', title: '赛博朋克创作组', workId: cyberRoot }).returning()
  await db.insert(conversationMembers).values([
    { conversationId: conv3.id, userId: userIds[0]! },
    { conversationId: conv3.id, userId: userIds[1]! },
    { conversationId: conv3.id, userId: userIds[2]! },
    { conversationId: conv3.id, userId: userIds[3]! },
  ])
  const msgs3 = [
    { senderIdx: 0, content: '大家好！欢迎加入赛博朋克共创群' },
    { senderIdx: 1, content: '太棒了，终于有组织了' },
    { senderIdx: 2, content: '我们可以讨论一下各条故事线的走向' },
    { senderIdx: 3, content: '我刚续写了虚拟觉醒那条线，大家看看怎么样' },
    { senderIdx: 0, content: '写得不错！AI导师这个角色很有发展潜力' },
    { senderIdx: 1, content: '同意，后面可以揭露AI导师的真实身份' },
  ]
  await db.insert(messages).values(msgs3.map(m => ({
    conversationId: conv3.id,
    senderId: userIds[m.senderIdx]!,
    content: m.content,
    msgType: 'text' as const,
  })))

  // Conv 4: group - parallel café discussion
  const [conv4] = await db.insert(conversations).values({ type: 'group', title: '平行咖啡馆讨论组', workId: cafeRoot }).returning()
  await db.insert(conversationMembers).values([
    { conversationId: conv4.id, userId: userIds[4]! },
    { conversationId: conv4.id, userId: userIds[0]! },
    { conversationId: conv4.id, userId: userIds[2]! },
  ])
  const msgs4 = [
    { senderIdx: 4, content: '平行咖啡馆的两条时间线，大家想往哪个方向发展？' },
    { senderIdx: 0, content: '左边的世界我在写，偏温情路线' },
    { senderIdx: 2, content: '右边的世界我来，走悬疑方向' },
    { senderIdx: 4, content: '太好了！两条线最后能不能汇合？' },
  ]
  await db.insert(messages).values(msgs4.map(m => ({
    conversationId: conv4.id,
    senderId: userIds[m.senderIdx]!,
    content: m.content,
    msgType: 'text' as const,
  })))

  console.log('预置数据初始化完成！')
}
