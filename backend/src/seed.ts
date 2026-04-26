import db from './database'
import bcrypt from 'bcryptjs'

interface SeedPage {
  description: string
  dialogue: string
}

interface SeedWork {
  title: string
  description: string
  type: 'comic' | 'drama'
  creator_id: number
  parent_work_id: number | null
  root_work_id: number | null
  status: string
  pages: SeedPage[]
}

const users = [
  { username: 'starcreator', nickname: '星辰画手', avatar: '🎨', bio: '喜欢画漫画的自由创作者' },
  { username: 'lighthunter', nickname: '光影猎人', avatar: '📷', bio: '摄影爱好者，擅长风光和人文' },
  { username: 'storyweaver', nickname: '故事编织者', avatar: '✍️', bio: '脑洞大开的剧情创作者' },
  { username: 'pixeltraveler', nickname: '像素旅人', avatar: '🎮', bio: 'AI绘图玩家，像素风爱好者' },
  { username: 'inkbreeze', nickname: '墨染清风', avatar: '🖌️', bio: '国风插画师，水墨风格' },
]

const DEFAULT_PASSWORD = '123456'

const comicWorks: SeedWork[] = [
  {
    title: '赛博朋克：霓虹之下',
    description: '2099年，新东京的地下城中，一个普通的快递员发现了改变世界的秘密...',
    type: 'comic',
    creator_id: 1,
    parent_work_id: null,
    root_work_id: null,
    status: 'published',
    pages: [
      { description: '新东京全景，霓虹灯照亮了整个天际线', dialogue: '' },
      { description: '主角小林骑着飞行摩托穿梭在高楼之间', dialogue: '又是忙碌的一天...' },
      { description: '小林收到一个神秘包裹，上面写着"不要打开"', dialogue: '这个包裹...好沉' },
    ]
  },
  {
    title: '赛博朋克：霓虹之下 - 暗影分支',
    description: '小林打开了包裹，里面是一个神经接口芯片...',
    type: 'comic',
    creator_id: 2,
    parent_work_id: 1,
    root_work_id: 1,
    status: 'published',
    pages: [
      { description: '小林犹豫再三，还是打开了包裹', dialogue: '对不起，我实在太好奇了' },
      { description: '一个闪烁着蓝光的芯片躺在盒子里', dialogue: '这是...神经接口芯片？！' },
      { description: '小林将芯片插入颈部接口，眼前出现了虚拟世界', dialogue: '我能看到...另一个世界' },
    ]
  },
  {
    title: '赛博朋克：霓虹之下 - 正义之路',
    description: '小林没有打开包裹，而是选择交给地下城的反抗军...',
    type: 'comic',
    creator_id: 3,
    parent_work_id: 1,
    root_work_id: 1,
    status: 'published',
    pages: [
      { description: '小林拿着包裹来到反抗军的秘密基地', dialogue: '我觉得这个东西不简单' },
      { description: '反抗军首领检查包裹后大惊失色', dialogue: '这是...传说中的"创世代码"！' },
    ]
  },
  {
    title: '赛博朋克：暗影分支 - 虚拟觉醒',
    description: '在虚拟世界中，小林遇到了AI导师...',
    type: 'comic',
    creator_id: 4,
    parent_work_id: 2,
    root_work_id: 1,
    status: 'published',
    pages: [
      { description: '虚拟世界中，一个由数据流构成的人形出现', dialogue: '欢迎来到真实的世界，小林' },
      { description: '小林发现自己拥有了操控数据的能力', dialogue: '这种力量...太不可思议了' },
    ]
  },
]

const dramaWorks: SeedWork[] = [
  {
    title: '平行咖啡馆',
    description: '每天早上8点，当咖啡馆的门铃响起，时间就会分裂成两条线...',
    type: 'drama',
    creator_id: 5,
    parent_work_id: null,
    root_work_id: null,
    status: 'published',
    pages: [
      { description: '一家复古风格的咖啡馆，门口挂着"平行"的招牌', dialogue: '' },
      { description: '女主角推开门，门铃叮当作响', dialogue: '老板，一杯拿铁' },
      { description: '时钟指向8:00，画面开始分裂成两半', dialogue: '（旁白）从这一刻起，一切都不同了' },
    ]
  },
  {
    title: '平行咖啡馆 - 左边的世界',
    description: '在这条时间线里，她遇到了童年好友...',
    type: 'drama',
    creator_id: 1,
    parent_work_id: null,
    root_work_id: null,
    status: 'published',
    pages: [
      { description: '她在角落看到了一个熟悉的身影', dialogue: '小雨？！你不是去了国外吗？' },
      { description: '两人相拥而泣', dialogue: '我回来了，再也不走了' },
    ]
  },
  {
    title: '平行咖啡馆 - 右边的世界',
    description: '在另一条时间线里，咖啡馆根本不存在...',
    type: 'drama',
    creator_id: 3,
    parent_work_id: null,
    root_work_id: null,
    status: 'published',
    pages: [
      { description: '她推开门，发现这里变成了一片废墟', dialogue: '这...这是怎么回事？' },
      { description: '废墟中间立着一块石碑："此地已于2020年拆除"', dialogue: '不可能...我明明刚才还...' },
    ]
  },
]

export default function seedData(): void {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  if (row.count > 0) {
    console.log('数据库已有数据，跳过初始化')
    return
  }

  console.log('开始初始化预置数据...')

  const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10)
  const insertUser = db.prepare('INSERT INTO users (username, password_hash, nickname, avatar, bio) VALUES (?, ?, ?, ?, ?)')
  const insertWork = db.prepare('INSERT INTO works (title, description, type, creator_id, parent_work_id, root_work_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertPage = db.prepare('INSERT INTO work_pages (work_id, page_number, image_url, description, dialogue) VALUES (?, ?, ?, ?, ?)')
  const insertContributor = db.prepare('INSERT OR IGNORE INTO contributors (work_id, user_id, role) VALUES (?, ?, ?)')
  const updateRootId = db.prepare('UPDATE works SET root_work_id = ? WHERE id = ?')

  const transaction = db.transaction(() => {
    for (const user of users) {
      insertUser.run(user.username, passwordHash, user.nickname, user.avatar, user.bio)
    }

    for (const work of comicWorks) {
      const result = insertWork.run(
        work.title, work.description, work.type,
        work.creator_id, work.parent_work_id, work.root_work_id, work.status
      )
      const workId = Number(result.lastInsertRowid)

      if (!work.parent_work_id) {
        updateRootId.run(workId, workId)
      }

      work.pages.forEach((page, index) => {
        insertPage.run(workId, index + 1, '', page.description, page.dialogue)
      })

      insertContributor.run(workId, work.creator_id, 'creator')
    }

    const dramaRootId = 5
    for (let i = 0; i < dramaWorks.length; i++) {
      const work = dramaWorks[i]!
      const parentId = i === 0 ? null : dramaRootId
      const rootId = i === 0 ? null : dramaRootId

      const result = insertWork.run(
        work.title, work.description, work.type,
        work.creator_id, parentId, rootId, work.status
      )
      const workId = Number(result.lastInsertRowid)

      if (i === 0) {
        updateRootId.run(workId, workId)
      }

      work.pages.forEach((page, index) => {
        insertPage.run(workId, index + 1, '', page.description, page.dialogue)
      })

      insertContributor.run(workId, work.creator_id, 'creator')
    }

    insertContributor.run(2, 1, 'ancestor')
    insertContributor.run(3, 1, 'ancestor')
    insertContributor.run(4, 1, 'ancestor')
    insertContributor.run(4, 2, 'ancestor')
    insertContributor.run(6, 5, 'ancestor')
    insertContributor.run(7, 5, 'ancestor')
  })

  transaction()

  const insertComment = db.prepare('INSERT INTO comments (work_id, user_id, content) VALUES (?, ?, ?)')
  insertComment.run(1, 2, '画风太棒了！赛博朋克的感觉拉满')
  insertComment.run(1, 3, '这个设定好有意思，我想续写一个新分支')
  insertComment.run(2, 1, '没想到你把小林的故事往这个方向发展了，很惊喜！')
  insertComment.run(2, 4, '虚拟世界的概念很酷，我来接着写')
  insertComment.run(5, 1, '时间分裂的设定好浪漫')
  insertComment.run(5, 2, '这个咖啡馆我想去坐坐')

  const insertBookmark = db.prepare('INSERT INTO bookmarks (user_id, work_id, read_status, last_read_page) VALUES (?, ?, ?, ?)')
  insertBookmark.run(1, 5, 'reading', 2)
  insertBookmark.run(1, 2, 'finished', 3)
  insertBookmark.run(1, 7, 'want_read', 0)
  insertBookmark.run(2, 1, 'reading', 2)
  insertBookmark.run(2, 5, 'want_read', 0)
  insertBookmark.run(3, 2, 'finished', 3)
  insertBookmark.run(3, 4, 'reading', 1)

  const insertConv = db.prepare('INSERT INTO conversations (type, title, work_id) VALUES (?, ?, ?)')
  const insertMember = db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)')
  const insertMsg = db.prepare('INSERT INTO messages (conversation_id, sender_id, content, msg_type) VALUES (?, ?, ?, ?)')

  insertConv.run('private', '', null)
  insertMember.run(1, 1); insertMember.run(1, 2)
  insertMsg.run(1, 2, '你的赛博朋克画风太赞了！能教我吗？', 'text')
  insertMsg.run(1, 1, '谢谢！其实主要是AI辅助的，选对风格就行', 'text')
  insertMsg.run(1, 2, '那我们可以一起共创一个新故事吗？', 'text')
  insertMsg.run(1, 1, '当然可以！你有什么想法？', 'text')
  insertMsg.run(1, 2, '我想做一个末日废土风格的，主角是个摄影师', 'text')

  insertConv.run('private', '', null)
  insertMember.run(2, 1); insertMember.run(2, 3)
  insertMsg.run(2, 3, '我续写了你的赛博朋克，正义之路那条线', 'text')
  insertMsg.run(2, 1, '看到了！反抗军的设定很有意思', 'text')
  insertMsg.run(2, 3, '后面我想让小林加入反抗军，你觉得呢？', 'text')

  insertConv.run('group', '赛博朋克创作组', 1)
  insertMember.run(3, 1); insertMember.run(3, 2); insertMember.run(3, 3); insertMember.run(3, 4)
  insertMsg.run(3, 1, '大家好！欢迎加入赛博朋克共创群', 'text')
  insertMsg.run(3, 2, '太棒了，终于有组织了', 'text')
  insertMsg.run(3, 3, '我们可以讨论一下各条故事线的走向', 'text')
  insertMsg.run(3, 4, '我刚续写了虚拟觉醒那条线，大家看看怎么样', 'text')
  insertMsg.run(3, 1, '写得不错！AI导师这个角色很有发展潜力', 'text')
  insertMsg.run(3, 2, '同意，后面可以揭露AI导师的真实身份', 'text')

  insertConv.run('group', '平行咖啡馆讨论组', 5)
  insertMember.run(4, 5); insertMember.run(4, 1); insertMember.run(4, 3)
  insertMsg.run(4, 5, '平行咖啡馆的两条时间线，大家想往哪个方向发展？', 'text')
  insertMsg.run(4, 1, '左边的世界我在写，偏温情路线', 'text')
  insertMsg.run(4, 3, '右边的世界我来，走悬疑方向', 'text')
  insertMsg.run(4, 5, '太好了！两条线最后能不能汇合？', 'text')

  console.log('预置数据初始化完成！')
}
