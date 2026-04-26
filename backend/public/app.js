const API = 'http://localhost:3000/api';

// 状态管理
let currentUser = 1; // 默认用户
let pageHistory = ['home'];
let allUsers = [];
let currentConvId = null;

// ============ 页面导航 ============

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');

  // 更新底部tab
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  const tabMap = { home: 0, shelf: 1, create: 2, messages: 3, profile: 4 };
  if (tabMap[pageId] !== undefined) {
    document.querySelectorAll('.tab-item')[tabMap[pageId]].classList.add('active');
  }

  // 聊天页显示输入栏和隐藏底部tab，其他页相反
  const chatBar = document.getElementById('chat-input-bar');
  const tabBar = document.querySelector('.tab-bar');
  if (pageId === 'chat') {
    chatBar.classList.add('active');
    tabBar.style.display = 'none';
  } else {
    chatBar.classList.remove('active');
    tabBar.style.display = 'flex';
  }

  // 滚动到顶部
  window.scrollTo(0, 0);
}

function navigateTo(pageId) {
  pageHistory.push(pageId);
  showPage(pageId);
}

function goBack() {
  if (pageHistory.length > 1) {
    pageHistory.pop();
    showPage(pageHistory[pageHistory.length - 1]);
  } else {
    showPage('home');
  }
}

// ============ 首页/发现页 ============

async function loadWorks(type = 'all') {
  const params = type !== 'all' ? `?type=${type}` : '';
  const res = await fetch(`${API}/works${params}`);
  const works = await res.json();
  renderWorksList(works);
}

function renderWorksList(works) {
  const container = document.getElementById('works-list');
  const gradients = ['cover-gradient-1','cover-gradient-2','cover-gradient-3','cover-gradient-4','cover-gradient-5','cover-gradient-6','cover-gradient-7'];

  container.innerHTML = works.map((work, i) => `
    <div class="work-card" onclick="openWorkDetail(${work.id})">
      <div class="work-card-cover ${gradients[i % gradients.length]}">
        <div class="cover-text">${work.description.substring(0, 40)}...</div>
        <span class="type-badge">${work.type === 'comic' ? '漫画' : '短剧'}</span>
        ${work.parent_work_id ? '<span class="fork-badge">续写</span>' : ''}
      </div>
      <div class="work-card-info">
        <div class="work-card-title">${work.title}</div>
        <div class="work-card-meta">
          <span class="avatar">${work.creator_avatar}</span>
          <span>${work.creator_name}</span>
        </div>
        <div class="work-card-stats">
          <span>🔀 ${work.fork_count} 续写</span>
          <span>💬 ${work.comment_count} 评论</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ============ 作品详情页 ============

async function openWorkDetail(workId) {
  navigateTo('detail');

  const [workRes, pagesRes, commentsRes] = await Promise.all([
    fetch(`${API}/works/${workId}`),
    fetch(`${API}/works/${workId}/pages`),
    fetch(`${API}/works/${workId}/comments`)
  ]);

  const work = await workRes.json();
  const pages = await pagesRes.json();
  const comments = await commentsRes.json();

  document.getElementById('detail-title-header').textContent = work.title;

  const container = document.getElementById('detail-content');
  container.innerHTML = `
    <!-- 作品信息 -->
    <div class="detail-hero">
      <h2>${work.title}</h2>
      <p class="desc">${work.description}</p>
      ${work.parentWork ? `<span class="parent-link" onclick="openWorkDetail(${work.parentWork.id})">续写自「${work.parentWork.title}」by ${work.parentWork.creator_name}</span>` : ''}
    </div>

    <!-- 共创者 -->
    <div class="contributors-section">
      <div class="contributors-title">共创者 (${work.contributors.length}人)</div>
      <div class="contributors-list">
        ${work.contributors.map(c => `
          <div class="contributor-item">
            <span>${c.avatar}</span>
            <span>${c.nickname}</span>
            <span class="role-tag">${c.role === 'creator' ? '创作者' : '上游作者'}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 分镜内容 -->
    <div class="pages-section">
      <h3>分镜内容 (${pages.length}页)</h3>
      ${pages.map(page => `
        <div class="page-item">
          <div class="page-item-image">
            ${page.description}
          </div>
          <div class="page-item-text">
            <div class="page-num">第${page.page_number}页</div>
            ${page.dialogue ? `<div class="dialogue">"${page.dialogue}"</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <button class="btn btn-primary" onclick="openForkPage(${work.id})">续写此作品</button>
      <button class="btn btn-secondary" onclick="openTreePage(${work.id})">创作树</button>
      <button class="btn btn-secondary" onclick="addToShelf(${work.id})">加入书架</button>
    </div>

    <!-- 评论区 -->
    <div class="comments-section">
      <h3>评论 (${comments.length})</h3>
      ${comments.map(c => `
        <div class="comment-item">
          <div class="comment-avatar">${c.avatar}</div>
          <div class="comment-body">
            <div class="comment-author">${c.nickname}</div>
            <div class="comment-text">${c.content}</div>
          </div>
        </div>
      `).join('')}
      ${comments.length === 0 ? '<p style="color: var(--text-secondary); font-size: 13px;">暂无评论</p>' : ''}
    </div>
  `;
}

// ============ 创作树页面 ============

async function openTreePage(workId) {
  navigateTo('tree');

  const res = await fetch(`${API}/works/${workId}/tree`);
  const tree = await res.json();

  const container = document.getElementById('tree-content');
  if (!tree) {
    container.innerHTML = '<p style="color: var(--text-secondary);">暂无创作树数据</p>';
    return;
  }

  container.innerHTML = `
    <h3 style="font-size: 16px; margin-bottom: 16px;">「${tree.title}」创作树</h3>
    <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 20px;">点击节点查看作品详情</p>
    ${renderTreeNode(tree, true)}
  `;
}

function renderTreeNode(node, isRoot = false) {
  return `
    <div class="tree-node">
      <div class="tree-node-card ${isRoot ? 'root' : ''}" onclick="openWorkDetail(${node.id})">
        <div class="node-title">${isRoot ? '🌟 ' : '🔀 '}${node.title}</div>
        <div class="node-meta">
          <span>${node.creator_avatar}</span>
          <span>${node.creator_name}</span>
        </div>
        ${node.fork_count > 0 ? `<div class="node-fork-count">${node.fork_count} 个续写分支</div>` : ''}
      </div>
      ${node.children && node.children.length > 0 ? `
        <div class="tree-children">
          ${node.children.map(child => renderTreeNode(child, false)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ============ 创作页面 ============

async function openCreatePage() {
  navigateTo('create');
  if (allUsers.length === 0) {
    const res = await fetch(`${API}/users`);
    allUsers = await res.json();
  }

  document.getElementById('create-content').innerHTML = `
    <!-- 用户选择 -->
    <div class="user-selector">
      <div class="user-selector-title">选择创作身份</div>
      <div class="user-options">
        ${allUsers.map(u => `
          <div class="user-option ${u.id === currentUser ? 'selected' : ''}" onclick="selectUser(${u.id}, this)">
            <span>${u.avatar}</span>
            <span>${u.nickname}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 创作模式切换 -->
    <div class="create-mode-tabs">
      <div class="create-mode-tab active" data-mode="manual" onclick="switchCreateMode('manual')">
        <span class="mode-icon">✍️</span>
        <span class="mode-label">自己创作</span>
        <span class="mode-desc">上传图片，编辑分镜和对白</span>
      </div>
      <div class="create-mode-tab" data-mode="ai" onclick="switchCreateMode('ai')">
        <span class="mode-icon">🤖</span>
        <span class="mode-label">AI创作</span>
        <span class="mode-desc">描述梗概，AI帮你生成作品</span>
      </div>
    </div>

    <!-- ===== 自己创作面板 ===== -->
    <div id="manual-panel" class="create-panel active">
      <div class="form-group">
        <label class="form-label">作品标题</label>
        <input class="form-input" id="create-title" placeholder="给你的作品起个名字">
      </div>
      <div class="form-group">
        <label class="form-label">作品简介</label>
        <textarea class="form-input" id="create-desc" placeholder="简单描述一下你的创作"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">作品类型</label>
        <select class="form-select" id="create-type">
          <option value="comic">漫画</option>
          <option value="drama">短剧</option>
        </select>
      </div>

      <!-- 分镜编辑器 -->
      <div class="pages-editor">
        <h3>分镜编辑</h3>
        <div id="pages-editor-list">
          <div class="page-edit-item" data-index="0">
            <div class="page-edit-num">第1页</div>
            <button class="remove-page-btn" onclick="removePage(this)">×</button>
            <div class="form-group">
              <label class="form-label">上传图片</label>
              <div class="upload-area" onclick="this.querySelector('input').click()">
                <input type="file" accept="image/*" style="display:none" onchange="previewUpload(this)">
                <div class="upload-placeholder">点击上传图片</div>
              </div>
            </div>
            <div class="form-group">
              <input class="form-input page-desc" placeholder="场景描述（如：主角站在城市天台上）">
            </div>
            <div class="form-group">
              <input class="form-input page-dialogue" placeholder="对白（选填）">
            </div>
          </div>
        </div>
        <button class="add-page-btn" onclick="addManualPage()">+ 添加分镜页</button>
      </div>

      <div style="margin-top: 20px;">
        <button class="btn btn-primary" onclick="submitCreate()" style="width: 100%;">发布作品</button>
      </div>
    </div>

    <!-- ===== AI创作面板 ===== -->
    <div id="ai-panel" class="create-panel">
      <div class="form-group">
        <label class="form-label">作品类型</label>
        <select class="form-select" id="ai-create-type">
          <option value="comic">漫画</option>
          <option value="drama">短剧</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">作品梗概</label>
        <textarea class="form-input ai-synopsis" id="ai-synopsis" placeholder="描述你想创作的故事，比如：&#10;&#10;在2099年的赛博朋克都市，一个快递员在送货途中捡到一个神秘芯片，插入后发现自己能看到平行世界...&#10;&#10;描述越详细，AI生成的效果越好"></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">画面风格</label>
        <div class="ai-styles">
          <div class="ai-style-item selected" data-style="cyberpunk" onclick="selectStyle(this)">
            <span class="style-icon">🌆</span>
            <span class="style-name">赛博朋克</span>
          </div>
          <div class="ai-style-item" data-style="watercolor" onclick="selectStyle(this)">
            <span class="style-icon">🎨</span>
            <span class="style-name">水彩</span>
          </div>
          <div class="ai-style-item" data-style="pixel" onclick="selectStyle(this)">
            <span class="style-icon">👾</span>
            <span class="style-name">像素风</span>
          </div>
          <div class="ai-style-item" data-style="ink" onclick="selectStyle(this)">
            <span class="style-icon">🖌️</span>
            <span class="style-name">水墨</span>
          </div>
          <div class="ai-style-item" data-style="comic" onclick="selectStyle(this)">
            <span class="style-icon">💥</span>
            <span class="style-name">美漫</span>
          </div>
          <div class="ai-style-item" data-style="anime" onclick="selectStyle(this)">
            <span class="style-icon">✨</span>
            <span class="style-name">日漫</span>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">生成页数</label>
        <div class="page-count-selector">
          <span class="page-count-btn" onclick="adjustPageCount(-1)">-</span>
          <span class="page-count-value" id="ai-page-count">4</span>
          <span class="page-count-btn" onclick="adjustPageCount(1)">+</span>
          <span class="page-count-hint">页分镜</span>
        </div>
      </div>

      <div style="margin-top: 20px;">
        <button class="btn btn-primary" onclick="submitAICreate()" style="width: 100%;" id="ai-generate-btn">AI 一键生成</button>
      </div>

      <!-- AI生成结果预览 -->
      <div id="ai-result" style="display: none;"></div>
    </div>
  `;
}

// 创作模式切换
function switchCreateMode(mode) {
  document.querySelectorAll('.create-mode-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.create-mode-tab[data-mode="${mode}"]`).classList.add('active');
  document.querySelectorAll('.create-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(mode === 'manual' ? 'manual-panel' : 'ai-panel').classList.add('active');
}

// 图片上传预览
function previewUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const area = input.closest('.upload-area');
    area.innerHTML = `
      <input type="file" accept="image/*" style="display:none" onchange="previewUpload(this)">
      <img src="${e.target.result}" style="width:100%; border-radius:8px;">
      <div class="upload-change-hint">点击更换</div>
    `;
    area.querySelector('input').files = input.files;
  };
  reader.readAsDataURL(file);
}

// 自己创作模式添加分镜
function addManualPage() {
  const container = document.getElementById('pages-editor-list');
  const count = container.children.length;
  const div = document.createElement('div');
  div.className = 'page-edit-item';
  div.dataset.index = count;
  div.innerHTML = `
    <div class="page-edit-num">第${count + 1}页</div>
    <button class="remove-page-btn" onclick="removePage(this)">×</button>
    <div class="form-group">
      <label class="form-label">上传图片</label>
      <div class="upload-area" onclick="this.querySelector('input').click()">
        <input type="file" accept="image/*" style="display:none" onchange="previewUpload(this)">
        <div class="upload-placeholder">点击上传图片</div>
      </div>
    </div>
    <div class="form-group">
      <input class="form-input page-desc" placeholder="场景描述">
    </div>
    <div class="form-group">
      <input class="form-input page-dialogue" placeholder="对白（选填）">
    </div>
  `;
  container.appendChild(div);
}

// AI页数调整
function adjustPageCount(delta) {
  const el = document.getElementById('ai-page-count');
  let count = parseInt(el.textContent) + delta;
  count = Math.max(2, Math.min(12, count));
  el.textContent = count;
}

// AI创作提交（Mock）
async function submitAICreate() {
  const synopsis = document.getElementById('ai-synopsis').value.trim();
  const type = document.getElementById('ai-create-type').value;
  const pageCount = parseInt(document.getElementById('ai-page-count').textContent);
  const style = document.querySelector('#ai-panel .ai-style-item.selected')?.dataset.style || 'cyberpunk';

  if (!synopsis) { showToast('请输入作品梗概'); return; }

  // 显示生成中状态
  const btn = document.getElementById('ai-generate-btn');
  btn.textContent = 'AI 生成中...';
  btn.disabled = true;

  // Mock: 模拟AI生成过程
  const resultContainer = document.getElementById('ai-result');
  resultContainer.style.display = 'block';
  resultContainer.innerHTML = `
    <div class="ai-generating">
      <div class="ai-generating-step active" id="ai-step-1">
        <div class="step-spinner"></div>
        <span>正在分析故事梗概...</span>
      </div>
      <div class="ai-generating-step" id="ai-step-2">
        <div class="step-spinner"></div>
        <span>正在生成故事大纲和分镜脚本...</span>
      </div>
      <div class="ai-generating-step" id="ai-step-3">
        <div class="step-spinner"></div>
        <span>正在生成${pageCount}页分镜画面...</span>
      </div>
    </div>
  `;

  // Mock分步动画
  await mockDelay(1200);
  document.getElementById('ai-step-1').classList.add('done');
  document.getElementById('ai-step-2').classList.add('active');

  await mockDelay(1500);
  document.getElementById('ai-step-2').classList.add('done');
  document.getElementById('ai-step-3').classList.add('active');

  await mockDelay(2000);
  document.getElementById('ai-step-3').classList.add('done');

  // Mock生成结果
  const mockTitle = synopsis.substring(0, 15) + (synopsis.length > 15 ? '...' : '');
  const styleNames = { cyberpunk:'赛博朋克', watercolor:'水彩', pixel:'像素', ink:'水墨', comic:'美漫', anime:'日漫' };
  const mockPages = generateMockPages(synopsis, pageCount);

  resultContainer.innerHTML = `
    <div class="ai-result-header">
      <h3>AI生成完成</h3>
      <p style="font-size: 12px; color: var(--text-secondary);">风格: ${styleNames[style] || style} · ${pageCount}页分镜</p>
    </div>
    <div class="form-group">
      <label class="form-label">作品标题（可修改）</label>
      <input class="form-input" id="ai-result-title" value="${mockTitle}">
    </div>
    <div class="form-group">
      <label class="form-label">作品简介（可修改）</label>
      <textarea class="form-input" id="ai-result-desc">${synopsis}</textarea>
    </div>
    <div class="ai-result-pages">
      <label class="form-label">生成的分镜（可修改）</label>
      ${mockPages.map((p, i) => `
        <div class="ai-result-page">
          <div class="ai-result-page-img cover-gradient-${(i % 7) + 1}">
            <span>${p.description.substring(0, 30)}</span>
          </div>
          <div class="ai-result-page-edit">
            <div class="page-edit-num">第${i + 1}页</div>
            <input class="form-input ai-page-desc" value="${p.description}" placeholder="场景描述">
            <input class="form-input ai-page-dialogue" value="${p.dialogue}" placeholder="对白" style="margin-top: 6px;">
          </div>
        </div>
      `).join('')}
    </div>
    <div style="display: flex; gap: 10px; margin-top: 16px;">
      <button class="btn btn-secondary" onclick="submitAICreate()" style="flex: 1;">重新生成</button>
      <button class="btn btn-primary" onclick="publishAIResult('${type}')" style="flex: 2;">确认发布</button>
    </div>
  `;

  btn.textContent = 'AI 一键生成';
  btn.disabled = false;
}

function mockDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mock生成分镜内容
function generateMockPages(synopsis, count) {
  const templates = [
    { desc: '开篇：故事的世界观展开，一个广阔的场景呈现在眼前', dial: '' },
    { desc: '主角登场，在日常场景中展现性格特点', dial: '又是普通的一天...' },
    { desc: '转折出现，一个意外事件打破了平静', dial: '这是怎么回事？！' },
    { desc: '主角面临选择，气氛变得紧张', dial: '我必须做出决定' },
    { desc: '冲突升级，主角遭遇强大的阻碍', dial: '没想到事情会变成这样...' },
    { desc: '关键时刻，主角获得了新的力量或帮助', dial: '原来如此！我明白了' },
    { desc: '高潮场景，主角与对手正面交锋', dial: '这次，我不会退缩！' },
    { desc: '战斗进入白热化，画面充满张力', dial: '' },
    { desc: '转机出现，意想不到的发展', dial: '不可能...这竟然是...' },
    { desc: '故事迎来阶段性结局，留下悬念', dial: '故事才刚刚开始...' },
    { desc: '尾声：一个新的谜团浮出水面', dial: '' },
    { desc: '彩蛋：暗示下一章的关键线索', dial: '你终于来了...' },
  ];

  // 根据梗概关键词做简单定制
  const pages = [];
  for (let i = 0; i < count; i++) {
    const t = templates[i % templates.length];
    pages.push({
      description: t.desc,
      dialogue: t.dial
    });
  }
  return pages;
}

// 发布AI生成的结果
async function publishAIResult(type) {
  const title = document.getElementById('ai-result-title').value.trim();
  const desc = document.getElementById('ai-result-desc').value.trim();
  const pageDescs = document.querySelectorAll('#ai-result .ai-page-desc');
  const pageDialogues = document.querySelectorAll('#ai-result .ai-page-dialogue');

  if (!title) { showToast('请输入标题'); return; }

  const pages = Array.from(pageDescs).map((el, i) => ({
    description: el.value,
    dialogue: pageDialogues[i]?.value || '',
    ai_generated: true
  }));

  const res = await fetch(`${API}/works`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description: desc, type, creator_id: currentUser, pages })
  });
  const data = await res.json();
  showToast('作品发布成功！');
  setTimeout(() => {
    loadWorks();
    showPage('home');
    pageHistory = ['home'];
  }, 500);
}

// ============ 续写页面 ============

async function openForkPage(parentWorkId) {
  navigateTo('fork');
  if (allUsers.length === 0) {
    const res = await fetch(`${API}/users`);
    allUsers = await res.json();
  }

  const parentRes = await fetch(`${API}/works/${parentWorkId}`);
  const parentWork = await parentRes.json();

  document.getElementById('fork-content').innerHTML = `
    <div style="background: var(--bg-card); border-radius: 10px; padding: 12px; margin-bottom: 16px; border: 1px solid var(--primary);">
      <div style="font-size: 12px; color: var(--primary-light); margin-bottom: 4px;">续写自</div>
      <div style="font-size: 15px; font-weight: 600;">「${parentWork.title}」</div>
      <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">by ${parentWork.creator_name}</div>
    </div>

    <!-- 用户选择 -->
    <div class="user-selector">
      <div class="user-selector-title">选择创作身份</div>
      <div class="user-options">
        ${allUsers.map(u => `
          <div class="user-option ${u.id === currentUser ? 'selected' : ''}" onclick="selectUser(${u.id}, this)">
            <span>${u.avatar}</span>
            <span>${u.nickname}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">续写标题</label>
      <input class="form-input" id="fork-title" placeholder="例：${parentWork.title} - 我的分支">
    </div>
    <div class="form-group">
      <label class="form-label">续写简介</label>
      <textarea class="form-input" id="fork-desc" placeholder="你想把故事带向哪个方向？"></textarea>
    </div>

    <!-- 分镜编辑器 -->
    <div class="pages-editor">
      <h3>续写分镜</h3>
      <div id="fork-pages-editor-list">
        <div class="page-edit-item" data-index="0">
          <div class="page-edit-num">第1页</div>
          <button class="remove-page-btn" onclick="removePage(this)">×</button>
          <div class="form-group">
            <input class="form-input page-desc" placeholder="场景描述">
          </div>
          <div class="form-group">
            <input class="form-input page-dialogue" placeholder="对白（选填）">
          </div>
        </div>
      </div>
      <button class="add-page-btn" onclick="addPage('fork-pages-editor-list')">+ 添加分镜页</button>
    </div>

    <div style="margin-top: 20px;">
      <button class="btn btn-primary" onclick="submitFork(${parentWorkId})" style="width: 100%;">🚀 发布续写</button>
    </div>
  `;
}

// ============ 个人中心 ============

async function loadProfile() {
  const [userRes, worksRes, contribRes] = await Promise.all([
    fetch(`${API}/users/${currentUser}`),
    fetch(`${API}/users/${currentUser}/works`),
    fetch(`${API}/users/${currentUser}/contributions`)
  ]);

  const user = await userRes.json();
  const works = await worksRes.json();
  const contributions = await contribRes.json();

  // 去重：contributions中去掉自己创作的
  const myWorkIds = new Set(works.map(w => w.id));
  const coCreated = contributions.filter(w => !myWorkIds.has(w.id));

  document.getElementById('profile-content').innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar">${user.avatar}</div>
      <div class="profile-name">${user.nickname}</div>
      <div class="profile-bio">${user.bio}</div>
      <div class="profile-stats">
        <div class="profile-stat">
          <div class="num">${works.length}</div>
          <div class="label">我的作品</div>
        </div>
        <div class="profile-stat">
          <div class="num">${coCreated.length}</div>
          <div class="label">参与共创</div>
        </div>
      </div>
    </div>

    <!-- 用户切换 -->
    <div style="padding: 12px 16px;">
      <div class="user-selector">
        <div class="user-selector-title">切换用户（Demo模式）</div>
        <div class="user-options" id="profile-user-options"></div>
      </div>
    </div>

    <div class="profile-section">
      <h3>我的作品</h3>
      ${works.length === 0 ? '<p style="color: var(--text-secondary); font-size: 13px;">还没有创作作品</p>' : ''}
      ${works.map(w => `
        <div class="profile-work-item" onclick="openWorkDetail(${w.id})">
          <div class="pw-icon">${w.type === 'comic' ? '📖' : '🎬'}</div>
          <div class="pw-info">
            <div class="pw-title">${w.title}</div>
            <div class="pw-meta">${w.type === 'comic' ? '漫画' : '短剧'}</div>
          </div>
        </div>
      `).join('')}
    </div>

    ${coCreated.length > 0 ? `
    <div class="profile-section">
      <h3>参与的共创</h3>
      ${coCreated.map(w => `
        <div class="profile-work-item" onclick="openWorkDetail(${w.id})">
          <div class="pw-icon">🤝</div>
          <div class="pw-info">
            <div class="pw-title">${w.title}</div>
            <div class="pw-meta">by ${w.creator_name}</div>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;

  // 加载用户切换选项
  if (allUsers.length === 0) {
    const res = await fetch(`${API}/users`);
    allUsers = await res.json();
  }
  const optionsContainer = document.getElementById('profile-user-options');
  if (optionsContainer) {
    optionsContainer.innerHTML = allUsers.map(u => `
      <div class="user-option ${u.id === currentUser ? 'selected' : ''}" onclick="switchUser(${u.id})">
        <span>${u.avatar}</span>
        <span>${u.nickname}</span>
      </div>
    `).join('');
  }
}

function switchUser(userId) {
  currentUser = userId;
  loadProfile();
}

// ============ 书架 ============

async function loadShelf(status = 'all') {
  const params = status !== 'all' ? `?status=${status}` : '';
  const res = await fetch(`${API}/users/${currentUser}/bookmarks${params}`);
  const bookmarks = await res.json();
  renderShelf(bookmarks);
}

function renderShelf(bookmarks) {
  const container = document.getElementById('shelf-content');
  const gradients = ['cover-gradient-1','cover-gradient-2','cover-gradient-3','cover-gradient-4','cover-gradient-5','cover-gradient-6','cover-gradient-7'];
  const statusLabels = { reading: '在读', want_read: '想读', finished: '已读完' };

  if (bookmarks.length === 0) {
    container.innerHTML = `
      <div class="shelf-empty">
        <div class="empty-icon">📚</div>
        <p>书架空空如也</p>
        <button class="btn btn-primary" onclick="showPage('home'); pageHistory=['home']; loadWorks();" style="display: inline-block; width: auto; padding: 10px 24px;">去发现页逛逛</button>
      </div>
    `;
    return;
  }

  container.innerHTML = bookmarks.map((bm, i) => {
    const progress = bm.total_pages > 0 ? Math.round((bm.last_read_page / bm.total_pages) * 100) : 0;
    return `
      <div class="shelf-item" onclick="openWorkDetail(${bm.work_id})">
        <div class="shelf-cover ${gradients[bm.work_id % gradients.length]}">
          ${bm.type === 'comic' ? '漫画' : '短剧'}
        </div>
        <div class="shelf-info">
          <div class="shelf-title">${bm.title}</div>
          <div class="shelf-author">${bm.creator_avatar} ${bm.creator_name}</div>
          <div class="shelf-progress">
            <div class="shelf-progress-bar">
              <div class="shelf-progress-fill" style="width: ${progress}%"></div>
            </div>
            <span class="shelf-progress-text">${bm.last_read_page}/${bm.total_pages}页</span>
          </div>
          <div class="shelf-actions">
            ${bm.read_status !== 'reading' ? `<button class="shelf-action-btn" onclick="event.stopPropagation(); updateBookmark(${bm.id}, 'reading')">标记在读</button>` : ''}
            ${bm.read_status !== 'finished' ? `<button class="shelf-action-btn" onclick="event.stopPropagation(); updateBookmark(${bm.id}, 'finished')">标记读完</button>` : ''}
            <button class="shelf-action-btn danger" onclick="event.stopPropagation(); removeBookmark(${bm.id})">移除</button>
          </div>
        </div>
        <span class="shelf-status-badge ${bm.read_status}">${statusLabels[bm.read_status]}</span>
      </div>
    `;
  }).join('');
}

async function addToShelf(workId) {
  // 先检查是否已收藏
  const checkRes = await fetch(`${API}/bookmarks/check?user_id=${currentUser}&work_id=${workId}`);
  const checkData = await checkRes.json();
  if (checkData.bookmarked) {
    showToast('已在书架中');
    return;
  }
  await fetch(`${API}/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUser, work_id: workId })
  });
  showToast('已加入书架');
}

async function updateBookmark(bookmarkId, readStatus) {
  await fetch(`${API}/bookmarks/${bookmarkId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ read_status: readStatus })
  });
  loadShelf(document.querySelector('.filter-tab[data-shelf].active')?.dataset.shelf || 'all');
}

async function removeBookmark(bookmarkId) {
  await fetch(`${API}/bookmarks/${bookmarkId}`, { method: 'DELETE' });
  showToast('已移出书架');
  loadShelf(document.querySelector('.filter-tab[data-shelf].active')?.dataset.shelf || 'all');
}

// ============ 消息 ============

async function loadConversations() {
  const res = await fetch(`${API}/users/${currentUser}/conversations`);
  const conversations = await res.json();
  renderConversationList(conversations);
}

function renderConversationList(conversations) {
  const container = document.getElementById('messages-list-content');

  if (conversations.length === 0) {
    container.innerHTML = `
      <div class="shelf-empty">
        <div class="empty-icon">💬</div>
        <p>还没有消息</p>
        <p style="font-size: 12px; color: var(--text-secondary);">去作品详情页找共创伙伴交流吧</p>
      </div>
    `;
    return;
  }

  container.innerHTML = conversations.map(conv => `
    <div class="conv-item" onclick="openChat(${conv.id})">
      <div class="conv-avatar ${conv.type}">
        ${conv.type === 'private' ? (conv.displayAvatar || '👤') : '👥'}
      </div>
      <div class="conv-info">
        <div class="conv-name">
          ${conv.displayName || conv.title || '会话'}
          ${conv.type === 'group' ? '<span class="group-tag">共创群</span>' : ''}
        </div>
        <div class="conv-last-msg">${conv.last_sender ? conv.last_sender + ': ' : ''}${conv.last_message || '暂无消息'}</div>
      </div>
      <div class="conv-time">${conv.members ? conv.members.length + '人' : ''}</div>
    </div>
  `).join('');
}

async function openChat(convId) {
  currentConvId = convId;
  navigateTo('chat');

  const res = await fetch(`${API}/conversations/${convId}/messages`);
  const data = await res.json();
  const { conversation, members, messages } = data;

  // 设置标题
  let title = conversation.title;
  if (conversation.type === 'private') {
    const other = members.find(m => m.id !== currentUser);
    title = other ? other.nickname : '私聊';
  }
  document.getElementById('chat-title-header').textContent = title;

  // 渲染消息
  const container = document.getElementById('chat-content');
  if (conversation.type === 'group' && conversation.work_id) {
    container.innerHTML = `<div class="chat-system-msg">共创群聊 · ${members.length}人</div>`;
  } else {
    container.innerHTML = '';
  }

  container.innerHTML += messages.map(msg => {
    const isMine = msg.sender_id === currentUser;
    return `
      <div class="chat-msg ${isMine ? 'mine' : ''}">
        <div class="chat-msg-avatar">${msg.sender_avatar}</div>
        <div class="chat-msg-body">
          <div class="chat-msg-name">${msg.sender_name}</div>
          <div class="chat-msg-bubble">${msg.content}</div>
        </div>
      </div>
    `;
  }).join('');

  // 滚动到底部
  setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100);
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content || !currentConvId) return;

  await fetch(`${API}/conversations/${currentConvId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender_id: currentUser, content, msg_type: 'text' })
  });

  input.value = '';
  openChat(currentConvId); // 刷新消息
}

// ============ 辅助函数 ============

function selectUser(userId, el) {
  currentUser = userId;
  el.closest('.user-options').querySelectorAll('.user-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function selectStyle(el) {
  el.closest('.ai-styles').querySelectorAll('.ai-style-item').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

function addPage(containerId = 'pages-editor-list') {
  const container = document.getElementById(containerId);
  const count = container.children.length;
  const div = document.createElement('div');
  div.className = 'page-edit-item';
  div.dataset.index = count;
  div.innerHTML = `
    <div class="page-edit-num">第${count + 1}页</div>
    <button class="remove-page-btn" onclick="removePage(this)">×</button>
    <div class="form-group">
      <input class="form-input page-desc" placeholder="场景描述">
    </div>
    <div class="form-group">
      <input class="form-input page-dialogue" placeholder="对白（选填）">
    </div>
  `;
  container.appendChild(div);
}

function removePage(btn) {
  const container = btn.closest('.pages-editor').querySelector('[id$="-list"], [id$="editor-list"]');
  if (container.children.length > 1) {
    btn.closest('.page-edit-item').remove();
    // 重新编号
    Array.from(container.children).forEach((item, i) => {
      item.querySelector('.page-edit-num').textContent = `第${i + 1}页`;
    });
  }
}

function collectPages(containerId) {
  const container = document.getElementById(containerId);
  return Array.from(container.children).map(item => ({
    description: item.querySelector('.page-desc').value,
    dialogue: item.querySelector('.page-dialogue').value,
    ai_generated: false
  }));
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

async function submitCreate() {
  const title = document.getElementById('create-title').value.trim();
  const desc = document.getElementById('create-desc').value.trim();
  const type = document.getElementById('create-type').value;
  const pages = collectPages('pages-editor-list');

  if (!title) { showToast('请输入标题'); return; }
  if (!pages[0].description) { showToast('请至少填写第一页场景描述'); return; }

  const res = await fetch(`${API}/works`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description: desc, type, creator_id: currentUser, pages })
  });
  const data = await res.json();
  showToast('作品发布成功！');
  setTimeout(() => {
    loadWorks();
    showPage('home');
    pageHistory = ['home'];
  }, 500);
}

async function submitFork(parentWorkId) {
  const title = document.getElementById('fork-title').value.trim();
  const desc = document.getElementById('fork-desc').value.trim();
  const pages = collectPages('fork-pages-editor-list');

  if (!title) { showToast('请输入标题'); return; }
  if (!pages[0].description) { showToast('请至少填写第一页场景描述'); return; }

  const res = await fetch(`${API}/works/${parentWorkId}/fork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description: desc, creator_id: currentUser, pages })
  });
  const data = await res.json();
  showToast('续写发布成功！');
  setTimeout(() => {
    openWorkDetail(data.id);
  }, 500);
}

// ============ 事件绑定 ============

// 底部Tab切换
document.querySelectorAll('.tab-item').forEach(tab => {
  tab.addEventListener('click', () => {
    const page = tab.dataset.page;
    pageHistory = [page];
    showPage(page);

    if (page === 'home') loadWorks();
    if (page === 'shelf') loadShelf();
    if (page === 'create') openCreatePage();
    if (page === 'messages') loadConversations();
    if (page === 'profile') loadProfile();
  });
});

// 筛选Tab切换（首页）
document.querySelectorAll('.filter-tab[data-type]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab[data-type]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadWorks(tab.dataset.type);
  });
});

// 筛选Tab切换（书架）
document.querySelectorAll('.filter-tab[data-shelf]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab[data-shelf]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadShelf(tab.dataset.shelf);
  });
});

// 聊天发送按钮
document.getElementById('chat-send-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// 初始化
loadWorks();
