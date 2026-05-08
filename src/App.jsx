import { useState, useEffect } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

const ALL_DIMS = [
  { id: 'fluxo',      label: 'Clareza do Fluxo',              abbr: 'FL' },
  { id: 'entrega',    label: 'Qualidade das Entregas',         abbr: 'EQ' },
  { id: 'comunic',    label: 'Comunicação Interna',            abbr: 'CM' },
  { id: 'carga',      label: 'Carga de Trabalho',              abbr: 'CG' },
  { id: 'process',    label: 'Confiança no Processo',          abbr: 'CP' },
  { id: 'colab',      label: 'Colaboração do Time',            abbr: 'CL' },
  { id: 'prioridade', label: 'Clareza das Prioridades',        abbr: 'PR' },
  { id: 'impede',     label: 'Gestão de Impedimentos',         abbr: 'IM' },
  { id: 'autonomia',  label: 'Autonomia do Time',              abbr: 'AU' },
  { id: 'previse',    label: 'Previsibilidade',                abbr: 'PV' },
  { id: 'backlog',    label: 'Saúde do Backlog',               abbr: 'BK' },
  { id: 'aprend',     label: 'Aprendizado Contínuo',           abbr: 'AP' },
];

const DEFAULT_SEL = ['fluxo', 'entrega', 'comunic', 'carga', 'process', 'colab', 'prioridade', 'impede'];
const COLORS = ['#7F77DD', '#1D9E75', '#D85A30', '#378ADD', '#BA7517', '#D4537E', '#639922', '#888780', '#9B59B6', '#1ABC9C', '#E67E22', '#3498DB'];
const LBL = { 1: 'Crítico', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Excelente' };

export default function App() {
  const [screen,       setScreen]       = useState('loading');
  const [session,      setSession]      = useState(null);
  const [evals,        setEvals]        = useState([]);
  const [hasSubmitted, setHasSub]       = useState(false);
  const [nick,         setNick]         = useState('');
  const [ratings,      setRatings]      = useState({});
  const [comments,     setComments]     = useState('');
  const [sessName,     setSessName]     = useState('Retro Otmow');
  const [selDims,      setSelDims]      = useState(DEFAULT_SEL);
  const [agenda,       setAgenda]       = useState('');
  const [loadingAI,    setLoadingAI]    = useState(false);
  const [err,          setErr]          = useState('');

  // Sincronized Action Plan state
  const [lessons,      setLessons]      = useState([]);
  const [actions,      setActions]      = useState([]);
  const [newLesson,    setNewLesson]    = useState('');
  const [newActionText, setNewActionText] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('');

  // Session history
  const [historyList,  setHistoryList]  = useState([]);
  const [historyView,  setHistoryView]  = useState(null); // { session, evals, actionPlan }

  useEffect(() => { loadData(); }, []);

  // Auto-refresh evals and action plan every 15s when on results screen
  useEffect(() => {
    if (screen !== 'results') return;
    const id = setInterval(refreshEvals, 15000);
    return () => clearInterval(id);
  }, [screen]);

  async function loadHistory() {
    try {
      const data = await window.firestoreHelpers.getHistory();
      setHistoryList(data);
    } catch (e) {}
  }

  async function openHistoryEntry(id) {
    try {
      const data = await window.firestoreHelpers.getHistoryEntry(id);
      setHistoryView(data);
      setScreen('history-view');
    } catch (e) {}
  }

  async function loadData() {
    let sess = null, evArr = [], submitted = false, savedNick = '';
    try { const r = await window.storage.get('retro:session', true); sess = JSON.parse(r.value); } catch (e) {}
    try { const r = await window.storage.get('retro:evals', true);   evArr = JSON.parse(r.value); } catch (e) {}
    try {
      const r = await window.storage.get('retro:mine');
      const d = JSON.parse(r.value);
      if (sess && d.sessionTs === sess.created) { submitted = true; savedNick = d.nick || ''; }
    } catch (e) {}
    setSession(sess); setEvals(evArr); setHasSub(submitted);
    if (savedNick) setNick(savedNick);
    await loadActionPlan();
    await loadHistory();
    setScreen('home');
  }

  async function loadActionPlan() {
    try {
      const data = await window.firestoreHelpers.getActionPlan();
      setLessons(data.lessons || []);
      setActions(data.actions || []);
    } catch (e) {}
  }

  async function saveActionPlan(updatedLessons, updatedActions) {
    try {
      await window.firestoreHelpers.saveActionPlan(updatedLessons, updatedActions);
    } catch (e) {}
  }

  function addLesson() {
    if (!newLesson.trim()) return;
    const updated = [...lessons, newLesson.trim()];
    setLessons(updated);
    setNewLesson('');
    saveActionPlan(updated, actions);
  }

  function removeLesson(idx) {
    const updated = lessons.filter((_, i) => i !== idx);
    setLessons(updated);
    saveActionPlan(updated, actions);
  }

  function addAction() {
    if (!newActionText.trim()) return;
    const item = {
      id: Math.random().toString(36).slice(2, 10),
      text: newActionText.trim(),
      owner: newActionOwner.trim() || 'Sem dono',
      done: false
    };
    const updated = [...actions, item];
    setActions(updated);
    setNewActionText('');
    setNewActionOwner('');
    saveActionPlan(lessons, updated);
  }

  function toggleAction(id) {
    const updated = actions.map(a => a.id === id ? { ...a, done: !a.done } : a);
    setActions(updated);
    saveActionPlan(lessons, updated);
  }

  function removeAction(id) {
    const updated = actions.filter(a => a.id !== id);
    setActions(updated);
    saveActionPlan(lessons, updated);
  }

  async function createSession() {
    const dims = ALL_DIMS.filter(d => selDims.includes(d.id));
    const sess = { name: sessName.trim() || 'Retro Otmow', dimensions: dims, created: Date.now().toString() };
    try {
      await window.storage.set('retro:session', JSON.stringify(sess), true);
      await window.storage.set('retro:evals',   JSON.stringify([]),   true);
      try { await window.storage.delete('retro:mine'); } catch (e) {}
      setSession(sess); setEvals([]); setHasSub(false); setAgenda(''); setErr('');
      setLessons([]); setActions([]);
      setScreen('home');
    } catch (e) { setErr('Erro ao criar sessão.'); }
  }

  async function submitEval() {
    if (!session) return;
    const ev = {
      id: Math.random().toString(36).slice(2, 10),
      ratings: { ...ratings },
      comments: comments.trim(),
      ts: Date.now()
    };
    let arr = [];
    try { const r = await window.storage.get('retro:evals', true); arr = JSON.parse(r.value); } catch (e) { arr = []; }
    arr.push(ev);
    try {
      await window.storage.set('retro:evals', JSON.stringify(arr), true);
      await window.storage.set('retro:mine', JSON.stringify({ submitted: true, nick, sessionTs: session.created }));
      setEvals(arr); setHasSub(true); setScreen('done');
    } catch (e) { setErr('Erro ao enviar. Tente novamente.'); }
  }

  async function refreshEvals() {
    try {
      const r = await window.storage.get('retro:evals', true);
      setEvals(JSON.parse(r.value));
      await loadActionPlan();
    } catch (e) {}
  }

  async function resetSession() {
    try { await window.storage.delete('retro:session', true); } catch (e) {}
    try { await window.storage.delete('retro:evals',   true); } catch (e) {}
    try { await window.storage.delete('retro:mine');          } catch (e) {}
    setSession(null); setEvals([]); setHasSub(false); setNick(''); setAgenda(''); setComments('');
    setSelDims(DEFAULT_SEL); setSessName('Retro Otmow'); setLessons([]); setActions([]);
    setScreen('home');
  }

  function startEval() {
    if (!session || !nick.trim()) return;
    const init = {};
    session.dimensions.forEach(d => { init[d.id] = 3; });
    setRatings(init);
    setComments('');
    setScreen('evaluate');
  }

  function getStats(dimId) {
    if (!evals.length) return { avg: 0, range: 0, sd: 0 };
    const vals = evals.map(e => e.ratings[dimId] || 3);
    const a = vals.reduce((x, y) => x + y, 0) / vals.length;
    const rng = Math.max(...vals) - Math.min(...vals);
    const sd = Math.sqrt(vals.map(v => (v - a) ** 2).reduce((x, y) => x + y, 0) / vals.length);
    return { avg: a, range: rng, sd };
  }

  function getChartData() {
    if (!session || !evals.length) return [];
    return session.dimensions.map(d => {
      const vals = evals.map(e => e.ratings[d.id] || 3);
      const avg = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
      const lbl = d.label.length > 15 ? d.label.slice(0, 14) + '…' : d.label;
      const entry = { dim: lbl, avg };
      evals.forEach((e, i) => { entry['p' + i] = e.ratings[d.id] || 3; });
      return entry;
    });
  }

  async function genAgenda() {
    if (!session || !evals.length) return;
    setLoadingAI(true); setAgenda('');
    const statsLines = session.dimensions.map(d => {
      const s = getStats(d.id);
      return `${d.label}: média ${s.avg.toFixed(1)}, variação ${s.range}pts`;
    }).join('; ');
    
    const commentsText = evals.filter(e => e.comments?.trim()).map(e => `"${e.comments}"`).join('; ');

    try {
      const promptText = `Roda de Impacto do time Otmow com ${evals.length} participante(s). Resultados quantitativos: ${statsLines}. Comentários qualitativos/opiniões enviadas: ${commentsText}. Monte uma pauta objetiva de retrospectiva: destaque 2 dimensões com maior divergência ou críticas como tópicos prioritários, 2 destaques positivos como celebração, e traga sugestões de 3 perguntas abertas baseadas nos comentários textuais e dados. Seja extremamente direto, amigável e prático. Não use marcadores ou formatação Markdown muito complexos, prefira parágrafos limpos e amigáveis.`;
      
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
      const data = await res.json();
      if (data.error) {
        setAgenda(`Configuração necessária: ${data.error}`);
      } else {
        setAgenda(data.text || 'Sem resposta da IA.');
      }
    } catch (e) {
      setAgenda('Erro ao conectar com a IA. Que tal focar nos pontos de divergência mostrados no painel abaixo?');
    }
    setLoadingAI(false);
  }

  function generateMarkdown(sess, evList, lessList, actList, agendaText) {
    const getStatsFn = (dimId) => {
      if (!evList.length) return { avg: 0, range: 0 };
      const vals = evList.map(e => e.ratings[dimId] || 3);
      const a = vals.reduce((x, y) => x + y, 0) / vals.length;
      return { avg: a, range: Math.max(...vals) - Math.min(...vals) };
    };
    let md = `# Relatório Oficial de Retrospectiva · Ótmow\n\n`;
    md += `**Sessão:** ${sess.name}\n`;
    md += `**Data do Relatório:** ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n`;
    md += `**Total de Participantes:** ${evList.length} participante(s)\n\n`;
    md += `--- \n\n## Notas Médias por Dimensão\n\n`;
    sess.dimensions.forEach(d => {
      const s = getStatsFn(d.id);
      md += `- **${d.label}:** Média **${s.avg.toFixed(1)}/5.0** (Variação: ${s.range}pts)\n`;
    });
    md += `\n--- \n\n## Comentários e Opiniões do Time (Anônimo)\n\n`;
    const comments = evList.filter(e => e.comments?.trim());
    if (comments.length > 0) {
      comments.forEach((e, idx) => { md += `> "${e.comments.trim()}"\n> *— Participante P${idx + 1}*\n\n`; });
    } else {
      md += `*Nenhum comentário textual enviado.*\n\n`;
    }
    md += `--- \n\n## Lições Aprendidas\n\n`;
    if (lessList.length > 0) { lessList.forEach(l => { md += `- ${l}\n`; }); } else { md += `*Nenhuma lição registrada.*\n`; }
    md += `\n--- \n\n## Plano de Ação & Responsáveis\n\n`;
    if (actList.length > 0) { actList.forEach(a => { md += `- [${a.done ? 'x' : ' '}] **${a.text}** (Responsável: *${a.owner}*)\n`; }); } else { md += `*Nenhum item criado.*\n`; }
    md += `\n`;
    if (agendaText) { md += `--- \n\n## Insights sugeridos pela IA\n\n${agendaText}\n\n`; }
    md += `--- \n*Relatório gerado automaticamente pela ferramenta de Retrospectivas Ótmow.*\n`;
    return md;
  }

  function exportReport() {
    if (!session) return;
    const blob = new Blob([generateMarkdown(session, evals, lessons, actions, agenda)], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_retro_otmow_${session.name.toLowerCase().replace(/\s+/g, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── Design tokens ──
  const C = {
    bg: 'radial-gradient(circle at 50% 0%, #EFF6FF 0%, #F8FAFC 100%)',
    bg2: '#FFFFFF',
    bg3: '#F8FAFC',
    border: '#E2E8F0',
    border2: '#CBD5E1',
    text: '#0F172A',
    muted: '#64748B',
    hint: '#94A3B8',
    purple: '#4F46E5',
    green: '#10B981',
    red: '#EF4444',
    cyan: '#0EA5E9'
  };

  const wrap  = { background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'Outfit', 'Inter', system-ui, sans-serif", boxSizing: 'border-box' };
  const inner = { maxWidth: 540, margin: '0 auto', padding: '40px 20px' };
  const card  = { background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 16, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' };
  const inp   = { width: '100%', background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 14, padding: '12px 16px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
  const btn   = { background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, color: C.muted, fontSize: 13, fontWeight: 600, padding: '10px 18px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
  const btnP  = { background: 'linear-gradient(135deg, #4F46E5 0%, #0EA5E9 100%)', border: 'none', borderRadius: 12, color: '#ffffff', fontSize: 14, fontWeight: 700, padding: '12px 24px', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)', letterSpacing: '0.02em' };
  const lbl   = { fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block' };
  const sep   = { border: 'none', borderTop: `1px solid ${C.border}`, margin: '24px 0' };

  function Header({ label, title }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32, paddingBottom: 24, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justify_content: 'space-between', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit', sans-serif" }}>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.05em', color: '#0F172A' }}>Ótmow</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginLeft: 8, borderLeft: '1px solid #E2E8F0', paddingLeft: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Retrospective</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#EFF6FF', border: '1px solid #DBEAFE', padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#1E40AF' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span>
            ENGINE ACTIVE
          </div>
        </div>
        <div>
          <span style={lbl}>{label}</span>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em', color: C.text }}>{title}</div>
        </div>
      </div>
    );
  }

  // ── LOADING ──
  if (screen === 'loading') return (
    <div style={wrap}>
      <div style={{ ...inner, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: 13, color: C.muted }}>Carregando projeto...</div>
      </div>
    </div>
  );

  // ── SETUP ──
  if (screen === 'setup') return (
    <div style={wrap}>
      <div style={inner}>
        <Header label="Facilitar · Otmow" title="Nova sessão" />

        <label style={lbl}>Nome da sessão</label>
        <input style={{ ...inp, marginBottom: 20 }} value={sessName} onChange={e => setSessName(e.target.value)} placeholder="Ex: Retro Sprint 42" />

        <label style={{ ...lbl, marginBottom: 4 }}>
          Dimensões — <span style={{ color: C.text }}>{selDims.length} selecionadas</span>
          <span style={{ color: C.hint, fontWeight: 400, textTransform: 'none', marginLeft: 6 }}>(mín. 5, máx. 12)</span>
        </label>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>Clique para selecionar ou deselecionar cada dimensão.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
          {ALL_DIMS.map(d => {
            const sel = selDims.includes(d.id);
            return (
              <div key={d.id} onClick={() => setSelDims(s => sel ? s.filter(x => x !== d.id) : [...s, d.id])}
                style={{
                  ...card, cursor: 'pointer', padding: '12px 14px', borderColor: sel ? C.purple : C.border,
                  background: sel ? '#EEF2FF' : C.bg2, marginBottom: 0, transition: 'all 0.15s',
                  boxShadow: sel ? '0 0 12px rgba(79, 70, 229, 0.1)' : '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: sel ? '#4F46E5' : '#F1F5F9', border: `1px solid ${sel ? '#4F46E5' : '#E2E8F0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: sel ? '#FFFFFF' : '#475569', flexShrink: 0 }}>{d.abbr}</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: sel ? C.purple : C.text }}>{d.label}</span>
                  {sel && <span style={{ marginLeft: 'auto', fontSize: 14, color: C.purple, fontWeight: 700 }}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn} onClick={() => setScreen('home')}>Voltar</button>
          <button style={{ ...btnP, flex: 1, opacity: selDims.length < 5 ? 0.5 : 1 }} onClick={createSession} disabled={selDims.length < 5}>
            Criar com {selDims.length} dimensões
          </button>
        </div>
        {err && <p style={{ fontSize: 12, color: C.red, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  );

  // ── HOME ──
  if (screen === 'home') return (
    <div style={wrap}>
      <div style={inner}>
        <Header label="Retrospectiva · Otmow" title="Roda de Impacto" />

        {!session ? (
          <>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>
              Nenhuma sessão ativa. O facilitador cria a sessão e compartilha o link — cada pessoa entra, digita seu nome e avalia anonimamente.
            </p>
            <button style={btnP} onClick={() => setScreen('setup')}>Criar nova sessão</button>
            {historyList.length > 0 && (
              <button style={{ ...btn, marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => { loadHistory(); setScreen('history'); }}>
                Ver histórico de sessões ({historyList.length})
              </button>
            )}
          </>
        ) : (
          <>
            <div style={{ ...card, borderColor: '#C7D2FE', background: '#EEF2FF', marginBottom: 20 }}>
              <span style={lbl}>Sessão ativa</span>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, color: C.purple }}>{session.name}</div>
              <div style={{ fontSize: 13, color: C.muted }}>
                {session.dimensions.length} dimensões &nbsp;·&nbsp;
                <span style={{ color: evals.length > 0 ? C.green : C.muted, fontWeight: 600 }}>{evals.length} respostas</span>
              </div>
            </div>

            {hasSubmitted ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#DEF7EC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <span style={{ color: C.green, fontSize: 20, fontWeight: 700 }}>✓</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Avaliação enviada!</div>
                <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
                  Obrigado, <strong style={{ color: C.text }}>{nick}</strong>. Sua resposta foi registrada de forma anônima.
                </p>
                <button style={{ ...btnP, background: C.green }} onClick={() => { setScreen('results'); refreshEvals(); }}>
                  Ver resultado do time
                </button>
              </div>
            ) : (
              <>
                <label style={{ ...lbl, marginBottom: 4 }}>Seu nome</label>
                <p style={{ fontSize: 12, color: C.hint, marginBottom: 10 }}>Aparece só pra você. Nos resultados você é anônimo(a).</p>
                <input style={{ ...inp, marginBottom: 16 }} value={nick} onChange={e => setNick(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') startEval(); }} placeholder="Como você quer ser chamado(a)?" />
                <button style={{ ...btnP, opacity: nick.trim() ? 1 : 0.5 }} onClick={startEval} disabled={!nick.trim()}>
                  Avaliar agora →
                </button>
              </>
            )}

            <hr style={sep} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button style={btn} onClick={() => { setScreen('results'); refreshEvals(); }}>Resultados</button>
              <button style={{ ...btn, fontSize: 12, color: C.muted }} onClick={() => setScreen('setup')}>Nova sessão</button>
              <button style={{ ...btn, fontSize: 12, color: C.muted }} onClick={() => { loadHistory(); setScreen('history'); }}>Histórico</button>
              <button style={{ ...btn, fontSize: 12, color: C.red, borderColor: 'rgba(239,68,68,0.2)' }} onClick={resetSession}>Limpar dados</button>
            </div>
            {err && <p style={{ fontSize: 12, color: C.red, marginTop: 10 }}>{err}</p>}
          </>
        )}
      </div>
    </div>
  );

  // ── EVALUATE ──
  if (screen === 'evaluate') return (
    <div style={wrap}>
      <div style={inner}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {nick.charAt(0).toUpperCase()}
          </div>
          <div>
            <span style={lbl}>Avaliando anonimamente</span>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{nick}</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
          Arraste cada slider de 1 (Crítico) a 5 (Excelente). Ninguém sabe quem deu qual pontuação.
        </p>

        {session && session.dimensions.map(d => (
          <div key={d.id} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: '#F1F5F9', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#475569', flexShrink: 0 }}>{d.abbr}</div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{d.label}</span>
              </div>
              <span style={{ fontSize: 12, color: C.muted, minWidth: 100, textAlign: 'right', fontWeight: 500 }}>
                {ratings[d.id]} — {LBL[ratings[d.id]]}
              </span>
            </div>
            <input type="range" min="1" max="5" step="1" value={ratings[d.id] || 3}
              onChange={e => setRatings(r => ({ ...r, [d.id]: parseInt(e.target.value) }))}
              style={{ width: '100%', accentColor: C.purple, cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
              <span style={{ fontSize: 10, color: C.hint }}>Crítico</span>
              <span style={{ fontSize: 10, color: C.hint }}>Excelente</span>
            </div>
          </div>
        ))}

        <hr style={sep} />
        
        {/* Qualitative comments addition */}
        <label style={{ ...lbl, marginBottom: 6 }}>Suas opiniões, críticas ou comentários (Aberto e Anônimo)</label>
        <p style={{ fontSize: 12, color: C.hint, marginBottom: 10 }}>Fique à vontade para detalhar o que está pegando ou elogiar conquistas.</p>
        <textarea style={{ ...inp, height: 100, resize: 'vertical', marginBottom: 20 }}
          value={comments} onChange={e => setComments(e.target.value)}
          placeholder="O que funcionou bem? O que podemos ajustar para melhorar? O que nos atrasou nesse ciclo?" />

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn} onClick={() => setScreen('home')}>Voltar</button>
          <button style={{ ...btnP, flex: 1 }} onClick={submitEval}>Enviar avaliação</button>
        </div>
        {err && <p style={{ fontSize: 12, color: C.red, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  );

  // ── DONE ──
  if (screen === 'done') return (
    <div style={wrap}>
      <div style={{ ...inner, textAlign: 'center', paddingTop: 56 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid #C7D2FE' }}>
          <span style={{ fontSize: 24, fontWeight: 900, color: C.purple, fontFamily: "'Outfit', sans-serif" }}>Ó</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Pronto, {nick}!</div>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, maxWidth: 360, margin: '0 auto 28px' }}>
          Sua avaliação quantitativa e opiniões textuais foram registradas de forma segura e anônima.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
          <button style={{ ...btnP, background: C.green }} onClick={() => { setScreen('results'); refreshEvals(); }}>Ver resultados do time</button>
          <button style={{ ...btn, justifyContent: 'center', width: '100%' }} onClick={() => setScreen('home')}>Início</button>
        </div>
      </div>
    </div>
  );

  // ── HISTORY LIST ──
  if (screen === 'history') return (
    <div style={wrap}>
      <div style={inner}>
        <Header label="Retrospectiva · Otmow" title="Histórico de Sessões" />
        {historyList.length === 0 ? (
          <p style={{ fontSize: 14, color: C.muted }}>Nenhuma sessão arquivada ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {historyList.map(h => (
              <div key={h.id} style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{h.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {new Date(h.archivedAt).toLocaleDateString('pt-BR')} &nbsp;·&nbsp;
                    <span style={{ color: C.green, fontWeight: 600 }}>{h.participants} participante(s)</span>
                  </div>
                </div>
                <button style={{ ...btn, padding: '8px 16px', fontSize: 12 }} onClick={() => openHistoryEntry(h.id)}>
                  Ver
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 24 }}>
          <button style={btn} onClick={() => setScreen('home')}>Voltar</button>
        </div>
      </div>
    </div>
  );

  // ── HISTORY VIEW (read-only) ──
  if (screen === 'history-view' && historyView) {
    const hSess  = historyView.session;
    const hEvals = historyView.evals || [];
    const hLess  = historyView.actionPlan?.lessons || [];
    const hActs  = historyView.actionPlan?.actions || [];

    function hGetStats(dimId) {
      if (!hEvals.length) return { avg: 0, range: 0, sd: 0 };
      const vals = hEvals.map(e => e.ratings[dimId] || 3);
      const a = vals.reduce((x, y) => x + y, 0) / vals.length;
      const rng = Math.max(...vals) - Math.min(...vals);
      const sd = Math.sqrt(vals.map(v => (v - a) ** 2).reduce((x, y) => x + y, 0) / vals.length);
      return { avg: a, range: rng, sd };
    }

    const hChartData = hSess.dimensions.map(d => {
      const vals = hEvals.map(e => e.ratings[d.id] || 3);
      const avg = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
      const lbl = d.label.length > 15 ? d.label.slice(0, 14) + '…' : d.label;
      const entry = { dim: lbl, avg };
      hEvals.forEach((e, i) => { entry['p' + i] = e.ratings[d.id] || 3; });
      return entry;
    });

    const hDimStats = hSess.dimensions.map(d => ({ ...d, ...hGetStats(d.id) }));
    const hBySD  = [...hDimStats].sort((a, b) => b.sd - a.sd);
    const hByAvg = [...hDimStats].sort((a, b) => b.avg - a.avg);

    return (
      <div style={wrap}>
        <div style={inner}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
            <div>
              <span style={lbl}>{hSess.name} · Arquivada</span>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Roda de Impacto</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>{hEvals.length} resp.</span>
              <button style={{ ...btn, padding: '6px 12px', fontSize: 12 }} onClick={() => setScreen('history')}>Voltar</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legenda:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 3, background: C.purple, display: 'inline-block', borderRadius: 2 }}></span>
              <span style={{ fontSize: 12, color: C.muted }}>Média do time</span>
            </div>
            {hEvals.map((ev, i) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 3, background: COLORS[i % COLORS.length], display: 'inline-block', borderRadius: 2, opacity: 0.7 }}></span>
                <span style={{ fontSize: 12, color: C.muted }}>P{i + 1}</span>
              </div>
            ))}
          </div>

          <div style={{ width: '100%', height: 300, marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={hChartData}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="dim" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#94A3B8', fontSize: 10 }} tickCount={6} />
                {hEvals.map((ev, i) => (
                  <Radar key={ev.id} name={`P${i + 1}`} dataKey={`p${i}`}
                    stroke={COLORS[i % COLORS.length]} fill="transparent"
                    strokeWidth={1.5} strokeDasharray="4 3"
                    dot={{ fill: COLORS[i % COLORS.length], r: 2 }} />
                ))}
                <Radar name="Média" dataKey="avg" stroke={C.purple} fill={C.purple} fillOpacity={0.1} strokeWidth={2.5} dot={{ fill: C.purple, r: 3.5 }} />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 12, color: C.text, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v, name) => [`${v} — ${LBL[Math.round(v)] || ''}`, name]} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Pontos de Atenção</div>
              {hBySD.slice(0, 2).map(d => (
                <div key={d.id} style={{ ...card, borderTop: `3px solid ${C.red}`, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: '#FEF2F2', border: '1px solid #FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.red, flexShrink: 0 }}>{d.abbr}</div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{d.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>Média {d.avg.toFixed(1)} · Variação {d.range}pts</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Destaques Positivos</div>
              {hByAvg.slice(0, 2).map(d => (
                <div key={d.id} style={{ ...card, borderTop: `3px solid ${C.green}`, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: '#ECFDF5', border: '1px solid #D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.green, flexShrink: 0 }}>{d.abbr}</div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{d.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>Média {d.avg.toFixed(1)} · {LBL[Math.round(d.avg)]}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...card, borderColor: C.border, marginBottom: 24 }}>
            <span style={lbl}>Comentários do Time (Anônimo)</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hEvals.filter(e => e.comments?.trim()).map((e, idx) => (
                <div key={e.id || idx} style={{ padding: '10px 14px', background: C.bg3, borderRadius: 8, fontSize: 13, borderLeft: `3px solid ${COLORS[idx % COLORS.length]}`, lineHeight: 1.5 }}>
                  <div style={{ fontStyle: 'italic', color: C.text, whiteSpace: 'pre-wrap' }}>&ldquo;{e.comments}&rdquo;</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textAlign: 'right', fontWeight: 600 }}>— Participante P{idx + 1}</div>
                </div>
              ))}
              {hEvals.filter(e => e.comments?.trim()).length === 0 && (
                <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>Nenhum comentário textual.</div>
              )}
            </div>
          </div>

          {(hLess.length > 0 || hActs.length > 0) && (
            <div style={{ ...card, borderColor: '#C7D2FE', background: '#F8FAFC', marginBottom: 24 }}>
              <span style={{ ...lbl, color: C.purple }}>Lições Aprendidas & Plano de Ação</span>
              {hLess.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Lições Aprendidas</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {hLess.map((l, i) => (
                      <div key={i} style={{ background: '#FFFFFF', padding: '8px 12px', borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}`, color: C.text }}>{l}</div>
                    ))}
                  </div>
                </div>
              )}
              {hActs.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>Plano de Ação</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {hActs.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', background: '#FFFFFF', padding: '10px 12px', borderRadius: 6, fontSize: 13, gap: 10, border: `1px solid ${C.border}`, borderLeft: `3px solid ${a.done ? C.green : C.purple}` }}>
                        <span style={{ marginTop: 1, flexShrink: 0, color: a.done ? C.green : C.muted, fontWeight: 700 }}>{a.done ? '✓' : '○'}</span>
                        <div style={{ flex: 1, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? C.muted : C.text }}>
                          <div>{a.text}</div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Responsável: <strong>{a.owner}</strong></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button style={{ ...btn, flex: 1, justifyContent: 'center', color: C.purple, border: `2px solid ${C.purple}`, fontWeight: 700 }}
              onClick={() => {
                const blob = new Blob([generateMarkdown(hSess, hEvals, hLess, hActs, '')], { type: 'text/markdown;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `relatorio_retro_otmow_${hSess.name.toLowerCase().replace(/\s+/g, '_')}.md`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}>
              Exportar Markdown
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS ──
  const chartData = getChartData();
  const dimStats  = session ? session.dimensions.map(d => ({ ...d, ...getStats(d.id) })) : [];
  const bySD      = [...dimStats].sort((a, b) => b.sd - a.sd);
  const byAvg     = [...dimStats].sort((a, b) => b.avg - a.avg);

  if (screen === 'results') return (
    <div style={wrap}>
      <div style={inner}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
          <div>
            <span style={lbl}>{session?.name}</span>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Roda de Impacto</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: evals.length > 0 ? C.green : C.muted, fontWeight: 600 }}>{evals.length} resp.</span>
            <button style={{ ...btn, padding: '6px 12px', fontSize: 12 }} onClick={refreshEvals}>Atualizar</button>
            <button style={{ ...btn, padding: '6px 12px', fontSize: 12 }} onClick={() => setScreen('home')}>Voltar</button>
          </div>
        </div>

        {evals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 0', color: C.muted }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: C.muted, fontWeight: 700 }}>...</div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Aguardando avaliações...</p>
            <p style={{ fontSize: 13, color: C.hint }}>Compartilhe este link com o time para que cada pessoa avalie.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legenda:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 12, height: 3, background: C.purple, display: 'inline-block', borderRadius: 2 }}></span>
                <span style={{ fontSize: 12, color: C.muted }}>Média do time</span>
              </div>
              {evals.map((ev, i) => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 3, background: COLORS[i % COLORS.length], display: 'inline-block', borderRadius: 2, opacity: 0.7 }}></span>
                  <span style={{ fontSize: 12, color: C.muted }}>P{i + 1}</span>
                </div>
              ))}
            </div>

            <div style={{ width: '100%', height: 300, marginBottom: 24 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="dim" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#94A3B8', fontSize: 10 }} tickCount={6} />
                  {evals.map((ev, i) => (
                    <Radar key={ev.id} name={`P${i + 1}`} dataKey={`p${i}`}
                      stroke={COLORS[i % COLORS.length]} fill="transparent"
                      strokeWidth={1.5} strokeDasharray="4 3"
                      dot={{ fill: COLORS[i % COLORS.length], r: 2 }} />
                  ))}
                  <Radar name="Média" dataKey="avg" stroke={C.purple} fill={C.purple} fillOpacity={0.1} strokeWidth={2.5} dot={{ fill: C.purple, r: 3.5 }} />
                  <Tooltip
                    contentStyle={{ background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 12, color: C.text, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(v, name) => [`${v} — ${LBL[Math.round(v)] || ''}`, name]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Pontos de atenção (Divergência)</div>
                {bySD.slice(0, 2).map(d => (
                  <div key={d.id} style={{ ...card, borderTop: `3px solid ${C.red}`, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: '#FEF2F2', border: '1px solid #FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.red, flexShrink: 0 }}>{d.abbr}</div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{d.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>Média {d.avg.toFixed(1)} · Variação {d.range}pt{d.range !== 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.hint, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Destaques Positivos</div>
                {byAvg.slice(0, 2).map(d => (
                  <div key={d.id} style={{ ...card, borderTop: `3px solid ${C.green}`, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, background: '#ECFDF5', border: '1px solid #D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.green, flexShrink: 0 }}>{d.abbr}</div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{d.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>Média {d.avg.toFixed(1)} · {LBL[Math.round(d.avg)]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* qualitative opinions/comments list */}
            <div style={{ ...card, borderColor: C.border, marginBottom: 24 }}>
              <span style={lbl}>Comentários e Opiniões do Time (Anônimo)</span>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Utilize esses feedbacks para descobrir "por que" certas áreas estão com pontuação baixa.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {evals.filter(e => e.comments?.trim()).map((e, idx) => (
                  <div key={e.id || idx} style={{ padding: '10px 14px', background: C.bg3, borderRadius: 8, fontSize: 13, borderLeft: `3px solid ${COLORS[idx % COLORS.length]}`, lineHeight: 1.5 }}>
                    <div style={{ fontStyle: 'italic', color: C.text, whiteSpace: 'pre-wrap' }}>&ldquo;{e.comments}&rdquo;</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textAlign: 'right', fontWeight: 600 }}>— Participante P{idx + 1}</div>
                  </div>
                ))}
                {evals.filter(e => e.comments?.trim()).length === 0 && (
                  <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>Nenhum comentário textual foi enviado nesta sessão.</div>
                )}
              </div>
            </div>

            {/* Sincronized Collaborative Action Plan Board */}
            <div style={{ ...card, borderColor: '#C7D2FE', background: '#F8FAFC', marginBottom: 24 }}>
              <span style={{ ...lbl, color: C.purple }}>Lições Aprendidas & Plano de Ação</span>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>O que iremos levar de aprendizado e quais as ações tomadas para melhorar? Escreva aqui para todos verem em tempo real.</p>
              
              {/* Lessons learned section */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>Lições Aprendidas</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input style={{ ...inp, padding: '8px 12px' }} value={newLesson} onChange={e => setNewLesson(e.target.value)} placeholder="Ex: Precisamos refinar as estórias 1 dia antes da planning." />
                  <button style={{ ...btn, background: C.purple, color: '#fff', border: 'none', fontWeight: 600, padding: '0 16px' }} onClick={addLesson}>Adicionar</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lessons.map((less, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', padding: '8px 12px', borderRadius: 6, fontSize: 13, border: `1px solid ${C.border}` }}>
                      <span style={{ color: C.text }}>{less}</span>
                      <span style={{ color: C.red, cursor: 'pointer', fontSize: 11, fontWeight: 700 }} onClick={() => removeLesson(idx)}>Excluir</span>
                    </div>
                  ))}
                  {lessons.length === 0 && <div style={{ fontSize: 12, color: C.hint, fontStyle: 'italic' }}>Nenhuma lição adicionada ainda.</div>}
                </div>
              </div>

              {/* Action items section */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>Plano de Ação (Tarefas)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  <input style={{ ...inp, padding: '8px 12px' }} value={newActionText} onChange={e => setNewActionText(e.target.value)} placeholder="Qual a ação para melhorar?" />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...inp, padding: '8px 12px', flex: 1 }} value={newActionOwner} onChange={e => setNewActionOwner(e.target.value)} placeholder="Quem é o responsável? (Dono)" />
                    <button style={{ ...btn, background: C.purple, color: '#fff', border: 'none', fontWeight: 600, padding: '0 16px' }} onClick={addAction}>Criar Ação</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {actions.map((act) => (
                    <div key={act.id} style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', padding: '10px 12px', borderRadius: 6, fontSize: 13, gap: 10, border: `1px solid ${C.border}`, borderLeft: `3px solid ${act.done ? C.green : C.purple}` }}>
                      <input type="checkbox" checked={act.done} onChange={() => toggleAction(act.id)} style={{ accentColor: C.green, cursor: 'pointer' }} />
                      <div style={{ flex: 1, textDecoration: act.done ? 'line-through' : 'none', color: act.done ? C.muted : C.text }}>
                        <div>{act.text}</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Responsável: <strong>{act.owner}</strong></div>
                      </div>
                      <span style={{ color: C.red, cursor: 'pointer', fontSize: 11, fontWeight: 700 }} onClick={() => removeAction(act.id)}>Excluir</span>
                    </div>
                  ))}
                  {actions.length === 0 && <div style={{ fontSize: 12, color: C.hint, fontStyle: 'italic' }}>Nenhuma ação criada ainda.</div>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <button
                style={{ ...btnP, background: 'linear-gradient(135deg, #4F46E5 0%, #10B981 100%)', opacity: loadingAI ? 0.7 : 1 }}
                onClick={genAgenda} disabled={loadingAI}>
                {loadingAI ? 'Analisando dados...' : 'Analisar sentimentos e sugerir pauta via IA'}
              </button>

              <button
                style={{ ...btn, background: '#FFFFFF', color: C.purple, border: `2px solid ${C.purple}`, fontWeight: 700, padding: '12px' }}
                onClick={exportReport}>
                Exportar Atas & Plano de Ação (Markdown)
              </button>
            </div>

            {agenda && (
              <div style={{ ...card, borderColor: '#C7D2FE' }}>
                <span style={{ ...lbl, marginBottom: 10 }}>Insights sugeridos pela IA</span>
                <div style={{ fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: C.text }}>{agenda}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
