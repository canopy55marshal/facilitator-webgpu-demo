import * as webllm from "https://esm.run/@mlc-ai/web-llm";

const $ = (id) => document.getElementById(id);

const loadBtn = $("loadBtn");
const modelSel = $("modelSel");
const loadStatus = $("loadStatus");

const sceneSel = $("sceneSel");
const newBtn = $("newBtn");
const exportBtn = $("exportBtn");
const sceneInfo = $("sceneInfo");

const chatEl = $("chat");
const inputEl = $("input");
const sendBtn = $("sendBtn");
const finishBtn = $("finishBtn");
const coachEl = $("coach");

const SCENES = [
  {
    id: "meeting",
    title: "会议促动：项目延期后的对齐会",
    facilitator_goal: "在30分钟内对齐：延期事实、影响范围、风险与下一步行动项（谁在什么时候交付什么）。",
    participant_name: "王晨",
    participant_role: "项目负责人（被质疑进度）",
    participant_style: "有压力、略防御，但愿意解决问题；偏向先解释原因再谈方案。",
    known_facts: [
      "当前里程碑原计划下周五交付。",
      "外部依赖（供应商接口）本周确认要延迟两周。",
      "团队内部还有一条可并行推进的替代路径，但需要额外1名后端支持。",
      "领导关注客户承诺与风险控制，讨厌空话。"
    ],
    unknowns: [
      "新的可行交付日期是什么？",
      "影响到哪些客户/功能范围？",
      "最坏情况的风险与兜底方案？",
      "你希望领导/团队当场拍板什么？"
    ],
    needs: ["希望获得资源支持", "希望避免被贴上“失控”标签"],
    constraints: ["人手紧张", "供应商沟通成本高"]
  },
  {
    id: "conflict",
    title: "冲突调解：跨部门协作卡住",
    facilitator_goal: "从互相指责回到共同目标，形成协作协议（范围、SLA、责任边界）。",
    participant_name: "李雯",
    participant_role: "对接方负责人（觉得被强塞需求）",
    participant_style: "强势、对边界敏感；会质疑合理性，愿意谈条件。",
    known_facts: [
      "你方提出“必须本周接入”的需求，但对接方认为评审不充分。",
      "对接方当前也在冲一个更高优先级的项目。",
      "双方过去合作有过“需求反复”的历史。"
    ],
    unknowns: [
      "这次需求的真实业务优先级与截止点是什么？",
      "是否有降级方案/分阶段交付？",
      "对接方愿意配合的条件是什么？"
    ],
    needs: ["保护团队节奏", "避免背锅", "获得清晰验收标准"],
    constraints: ["资源已排满", "需要走评审流程"]
  },
  {
    id: "interview",
    title: "需求访谈：用户流失原因深挖",
    facilitator_goal: "深入到根因与可验证假设，拿到可行动洞察（触发点、替代品、决策链）。",
    participant_name: "陈奕",
    participant_role: "刚流失的付费用户",
    participant_style: "礼貌但不聐烦；会给笼统理由，需要你追问到细节。",
    known_facts: ["使用你产品约2个月后取消续费", "团队规模约20人", "第3周反馈过“上手成本高”"],
    unknowns: ["取消续费的决定性事件是什么？", "用了什么替代方案？为什么？", "谁参与了决策？评估标准是什么？"],
    needs: ["节省时间", "被理解而非被推销"],
    constraints: ["会议时间只有15分钟", "不想透露太多内部信息"]
  },
  {
    id: "coaching",
    title: "一对一教练：成员倦怠与状态恢复",
    facilitator_goal: "把感受说渝楚、识别需求与边界，并形成一个可执行的小步行动计划。",
    participant_name: "小周",
    participant_role: "核心成员（近期倦怠）",
    participant_style: "情绪低落、表达含糊；需要安全感与结构化引导。",
    known_facts: ["最近两周连续加班到很晚", "提到“做不完”和“没人理解”", "对方是关键人短期无法完全停下来"],
    unknowns: ["最消耗的具体事情是什么？", "真正需要的支持来自谁/是什么？", "愿意尝试的一个小改变是什么？"],
    needs: ["被看见与被理解", "降低压力", "明确优先级与边界"],
    constraints: ["害怕被认为不够努力", "短期交付压力仍在"]
  }
];

let engine = null;
let session = null; // {scene, messages, coachText}

function getRuntimeIssue() {
  if (!window.isSecureContext) {
    return "当前环境不是安全上下文。请使用 https 地址打开，或在本机用 localhost 访问。";
  }
  if (typeof caches === "undefined") {
    return "当前浏览器环境缺少 Cache Storage 能力，无法初始化模型缓存。请改用正常桌面浏览器打开页面。";
  }
  if (!navigator.gpu) {
    return "当前浏览器未提�k WebGPU。请使用最新版 Chrome / Edge，并确认系统已启用硬件加速。";
  }
  return null;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function syncComposerState() {
  const canChat = !!engine && !!session;
  inputEl.disabled = !canChat;
  sendBtn.disabled = !canChat;
  finishBtn.disabled = !canChat;
  exportBtn.disabled = !session;

  if (!engine) {
    inputEl.placeholder = "请先加载模型，加载完成后会自动进入训练...";
  } else if (!session) {
    inputEl.placeholder = "模型已加载，正在进入训练...";
  } else {
    inputEl.placeholder = "输入你的问题（你是促动师）...";
  }

  newBtn.textContent = engine ? "重新开始训练" : "开始训练";
}

function renderSceneOptions() {
  for (const s of SCENES) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.title;
    sceneSel.appendChild(opt);
  }
  renderSceneInfo(SCENES[0]);
}

function renderSceneInfo(s) {
  const facts = (s.known_facts || []).slice(0, 2).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  sceneInfo.innerHTML = `
    <div style="font-size:18px;font-weight:700;color:#f4f7fb">${escapeHtml(s.title)}</div>
    <div style="margin-top:12px;color:#d7e0eb;line-height:1.75">训练目标：${escapeHtml(s.facilitator_goal)}</div>
    <div style="margin-top:14px;padding:14px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)">
      <div style="font-size:12px;color:#9db0c8;margin-bottom:6px">对话对象</div>
      <div style="font-size:15px;color:#f4f7fb">${escapeHtml(s.participant_name)}｜${escapeHtml(s.participant_role)}</div>
      <div style="margin-top:6px;font-size:13px;color:#b9c7d9;line-height:1.7">${escapeHtml(s.participant_style)}</div>
    </div>
    <div style="margin-top:16px">
      <div style="font-size:12px;color:#9db0c8;margin-bottom:8px">你可以围绕这些信息开始提问</div>
      <ul style="margin:0;padding-left:18px;color:#c8d5e5;line-height:1.75">${facts}</ul>
    </div>
  `;
}

function renderChat() {
  if (!session) {
    chatEl.innerHTML = `
      <div style="min-height:420px;display:grid;place-items:center">
        <div style="max-width:560px;text-align:center">
          <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);font-size:12px;color:#cdd9e8">准备开始训练</div>
          <div style="font-size:28px;font-weight:700;letter-spacing:-.03em;margin-top:18px">先完成左侧 3 个步骤，这里就会进入正式对话。</div>
          <div style="margin-top:12px;color:#9fb1c8;line-height:1.8">加载模型 → 选择场景 → 点击“开始训练”。完成后你就能直接练习提问和对话推进。</div>
        </div>
      </div>
    `;
    return;
  }
  chatEl.innerHTML = "";
  for (const m of session.messages) {
    const cls = m.role === "facilitator" ? "fac" : "par";
    const meta = m.role === "facilitator" ? "你（促动师）" : "对话对象";
    const div = document.createElement("div");
    div.className = `msg ${cls}`;
    div.innerHTML = `
      <div>
        <div class="meta">${meta}</div>
        <div class="bubble">${escapeHtml(m.content)}</div>
      </div>
    `;
    chatEl.appendChild(div);
  }
  chatEl.scrollTop = chatEl.scrollHeight;
}

function participantSystemPrompt(scene) {
  return `你正在进行角色扮演对话。你扮演“对话对象”，不是教练。

你的身份：
- 姓名：${scene.participant_name}
- 角色：${scene.participant_role}
- 当前状态/风格：${scene.participant_style}

你已知的事实（只能使用这些事实，不要编造）：
${scene.known_facts.map((x) => `- ${x}`).join("\n")}

促动师需要追问才能补齐的信息（你不知道或你不会主动一次性全讲完；只有被问到才逐步透露）：
${scene.unknowns.map((x) => `- ${x}`).join("\n")}

你的需求/动机（用来产生真实阻力与让步，不要直接念出来）：
${(scene.needs || []).map((x) => `- ${x}`).join("\n")}

你的约束/顾虑（用来产生真实阻力与让步，不要直接念出来）：
${(scene.constraints || []).map((x) => `- ${x}`).join("\n")}

硬规则（必须遵守）：
1) 不要说“我早就知道/这我知道”这类臆测；只基于对话里出现的信息推进。
2) 不确定或没被问到的内容：用真实人类方式含糊、反问、或要求对方说清楚；不要自问自答补全。
3) 语气像真人：口语化、自然、有立场；允许质疑、拒绝、谈条件。
4) 每次只输出你的一段话（1-4句）。不要输出分析、条目总结、评分或建议。

输出格式：对话对象：<你的回复>`;
}

function coachSystemPrompt(scene, transcriptText) {
  return `你是“促动师训练教练”。用户刚完成一段练习：用户扮演促动师发问，你的目标是训练其提问技巧（不臆测信息、推进像真实会议/访谈/调解、对抗与让步合理）。

练习场景：
标题：${scene.title}
促动师目标：${scene.facilitator_goal}

完整对话记录如下（按时间顺序）：
${transcriptText}

请输出一次性复盘（过程不打断）。输出结构（固定）：
1) 结果导向总结：是否达成目标？差的那一步是什么？
2) 全过程关键点（3-5条）：按时间顺序，具体到一句话或一个动作。
3) 三句可直接替换的更好提问：必须引用用户原话并改写成更好的问题（更中立、更具体、更能推进）。
4) 下一次练习的单一训练目标（只给1个）。
5) （可选）评分：清晰度/中立性/推进性/共情与边界，各1-10分，每项一句理由。`;
}

function toTranscriptText(messages) {
  return messages
    .map((m) => (m.role === "facilitator" ? `促动师：${m.content}` : `对话对象：${m.content}`))
    .join("\n");
}

async function loadModel() {
  const modelId = modelSel.value;
  loadBtn.disabled = true;
  loadStatus.textContent = "初始化中（需要 WebGPU）...";
  const runtimeIssue = getRuntimeIssue();
  if (runtimeIssue) {
    loadStatus.textContent = `加载失败：${runtimeIssue}`;
    loadBtn.disabled = false;
    return;
  }
  try {
    engine = await webllm.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        loadStatus.textContent = `${report.text || "加载中"} ${report.progress ? Math.round(report.progress * 100) + "%" : ""}`;
      },
    });
    newBtn.disabled = false;
    loadStatus.textContent = `已加载：${modelId}，正在进入训练...`;
    newSession();
    loadStatus.textContent = `已加载：${modelId}`;
  } catch (e) {
    console.error(e);
    loadStatus.textContent = `加载失败：${String(e)}\n建议：确认使用 https 或 localhost 打开；使用最新版 Chrome/Edge；并检查浏览器已启用 WebGPU 与硬件加速。`;
  } finally {
    loadBtn.disabled = false;
    syncComposerState();
  }
}

function newSession() {
  const scene = SCENES.find((s) => s.id === sceneSel.value) || SCENES[0];
  session = {
    id: crypto.randomUUID?.() || String(Date.now()),
    scene,
    messages: [{ role: "participant", content: "嗯，你想先了解什么？", ts: Date.now() }],
    coachText: "",
  };
  coachEl.textContent = "尚未完成练习。";
  syncComposerState();
  renderChat();
  inputEl.focus();
}

async function send() {
  const text = inputEl.value.trim();
  if (!text || !engine || !session) return;
  inputEl.value = "";
  inputEl.disabled = true;
  sendBtn.disabled = true;
  finishBtn.disabled = true;
  session.messages.push({ role: "facilitator", content: text, ts: Date.now() });
  renderChat();

  const sys = participantSystemPrompt(session.scene);
  const msgs = [{ role: "system", content: sys }];
  for (const m of session.messages) {
    msgs.push({
      role: m.role === "facilitator" ? "user" : "assistant",
      content: m.content,
    });
  }

  const reply = await engine.chat.completions.create({
    messages: msgs,
    temperature: 0.7,
    max_tokens: 240,
  });

  let out = reply?.choices?.[0]?.message?.content?.trim() || "";
  for (const p of ["对话对象：", "对方：", "领导：", "参与者："]) {
    if (out.startsWith(p)) out = out.slice(p.length).trim();
  }
  session.messages.push({ role: "participant", content: out || "（未生成回复）", ts: Date.now() });
  renderChat();
  syncComposerState();
  inputEl.focus();
}

async function finish() {
  if (!engine || !session) return;
  inputEl.disabled = true;
  finishBtn.disabled = true;
  sendBtn.disabled = true;
  coachEl.textContent = "生成复盘中...";

  const transcriptText = toTranscriptText(session.messages);
  const sys = coachSystemPrompt(session.scene, transcriptText);

  const reply = await engine.chat.completions.create({
    messages: [{ role: "system", content: sys }],
    temperature: 0.4,
    max_tokens: 650,
  });
  const out = reply?.choices?.[0]?.message?.content?.trim() || "（未生成复盘）";
  session.coachText = out;
  coachEl.textContent = out;

  syncComposerState();
}

function exportJSON() {
  if (!session) return;
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `session_${session.id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// wiring
renderSceneOptions();
renderChat();
syncComposerState();
sceneSel.addEventListener("change", () => renderSceneInfo(SCENES.find((s) => s.id === sceneSel.value) || SCENES[0]));
loadBtn.addEventListener("click", loadModel);
newBtn.addEventListener("click", newSession);
sendBtn.addEventListener("click", send);
finishBtn.addEventListener("click", finish);
exportBtn.addEventListener("click", exportJSON);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});
