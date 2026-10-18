import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, CalendarDays, ChartNoAxesCombined, ClipboardList, Database, Download, FileUp,
  FlaskConical, LayoutDashboard, Moon, Package, Plus, Search, Settings, Sun, Syringe,
  Trash2, Upload, X, Pencil, AlertTriangle, CheckCircle2, ChevronDown, RotateCcw
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { calculateAllLevels, calculateLevel } from './calculations/decayModels.js';
import { calculateConcentration, calculateDiluentVolume } from './calculations/concentration.js';
import { downloadText, exportJson, loadState, saveState } from './services/storage.js';
import { readImportFile, toCsv } from './services/importExport.js';

const today = () => new Date().toISOString().slice(0,10);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const fmt = d => d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : '—';
const num = (v, digits=2) => Number.isFinite(Number(v)) ? Number(v).toLocaleString(undefined,{maximumFractionDigits:digits}) : '—';

function IconButton({title, onClick, children, danger=false}) {
  return <button className={`icon-button ${danger?'danger':''}`} title={title} aria-label={title} onClick={onClick}>{children}</button>;
}
function Field({label, children, hint}) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function Stat({label,value,sub,icon:Icon,accent='blue'}) {
  return <div className={`stat-card accent-${accent}`}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={18}/></span></div><strong>{value}</strong><small>{sub}</small></div>;
}
function Modal({title,onClose,children}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal" role="dialog" aria-modal="true"><header><h2>{title}</h2><IconButton title="Close" onClick={onClose}><X size={18}/></IconButton></header>{children}</section></div>;
}

export default function App() {
  const [state,setState] = useState(loadState);
  const [tab,setTab] = useState('review');
  const [selectedDate,setSelectedDate] = useState(today());
  const [search,setSearch] = useState('');
  const [compoundFilter,setCompoundFilter] = useState('All');
  const [modal,setModal] = useState(null);
  const [editing,setEditing] = useState(null);
  const [notice,setNotice] = useState('');
  const [importRows,setImportRows] = useState(null);
  const [importName,setImportName] = useState('');
  const [showFormulaDetails,setShowFormulaDetails] = useState(false);
  const [settingsDraft,setSettingsDraft] = useState(null);
  const importRef = useRef(null);
  useEffect(()=>{ saveState(state); document.documentElement.dataset.theme=state.settings.theme; },[state]);
  useEffect(()=>{ if(!notice) return; const t=setTimeout(()=>setNotice(''),4200); return ()=>clearTimeout(t); },[notice]);
  const update = fn => setState(s=>fn(structuredClone(s)));
  const injections = state.injections;
  const compounds = [...new Set(['Reta','Tirz',...injections.map(i=>i.compound),...state.supplies.map(i=>i.compound)])];
  const levels = calculateAllLevels(injections, selectedDate, state.settings.formulas);
  const chartData = useMemo(()=>{
    const dates = new Set([today(),selectedDate,...injections.map(i=>i.date)]);
    const sorted=[...dates].filter(Boolean).sort();
    if(sorted.length<2) return sorted.map(date=>({date,label:fmt(date),...calculateAllLevels(injections,date,state.settings.formulas)}));
    const start=new Date(`${sorted[0]}T12:00:00`), end=new Date(`${sorted[sorted.length-1]}T12:00:00`);
    const days=Math.min(180,Math.max(1,Math.ceil((end-start)/86400000)));
    const all=[];
    for(let i=0;i<=days;i++){
      const d=new Date(start); d.setDate(d.getDate()+i); const date=d.toISOString().slice(0,10);
      all.push({date,label:fmt(date),...calculateAllLevels(injections,date,state.settings.formulas)});
    }
    return all;
  },[injections,selectedDate,state.settings.formulas]);
  const lastFor = c => injections.filter(i=>i.compound===c && i.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const nextFor = c => {
    const last=lastFor(c); if(!last) return null;
    const d=new Date(`${last.date}T12:00:00`); d.setDate(d.getDate()+Number(state.settings.intervals[c] ?? 7));
    return d.toISOString().slice(0,10);
  };
  const filtered = injections.filter(i=>(compoundFilter==='All'||i.compound===compoundFilter) && `${i.date} ${i.compound} ${i.doseMg} ${i.units} ${i.notes||''}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date));
  const addInjection = (record, source='form') => {
    if(!record.date || !record.compound || record.doseMg==='' || !Number.isFinite(Number(record.doseMg)) || Number(record.doseMg)<0) { setNotice('Enter a valid date, compound, and non-negative dose.'); return; }
    const duplicate=injections.some(i=>i.id!==record.id&&i.date===record.date&&i.compound===record.compound&&Number(i.doseMg)===Number(record.doseMg));
    if(duplicate && !window.confirm('A record with the same date, compound, and dose already exists. Add it anyway?')) return;
    const amount=Number(record.doseMg);
    update(s=>{
      const entry={...record,id:record.id||uid(),doseMg:amount,units:record.units===''?'':Number(record.units),notes:record.notes||''};
      if(record.id) s.injections=s.injections.map(i=>i.id===record.id?entry:i);
      else s.injections.push(entry);
      if(record.preparedVialId){
        const vial=s.preparedVials.find(v=>v.id===record.preparedVialId);
        if(vial && !record.id){
          const conc=calculateConcentration(vial.compoundMg,vial.diluentMl);
          const usedMl=conc>0?amount/conc:0;
          if(usedMl <= Number(vial.remainingMl)+1e-8){
            vial.remainingMl=Math.max(0,Number(vial.remainingMl)-usedMl);
            vial.remainingMg=Math.max(0,Number(vial.remainingMg)-amount);
            s.ledger.push({id:uid(),date:record.date,kind:'injection-use',description:`${record.compound} injection ${amount} mg from prepared vial`,amountMg:-amount,sourceId:vial.id});
          } else {
            s.ledger.push({id:uid(),date:record.date,kind:'warning',description:`Injection associated with ${vial.label||vial.id}; vial quantity needs reconciliation`,amountMg:0,sourceId:vial.id});
          }
        }
      }
      return s;
    });
    setModal(null);setEditing(null);setNotice(record.id?'Injection updated.':'Injection saved.');
  };
  const deleteInjection = id => {
    if(!window.confirm('Delete this injection record? Inventory ledger entries will be retained for audit.')) return;
    update(s=>{s.injections=s.injections.filter(i=>i.id!==id);s.ledger.push({id:uid(),date:today(),kind:'record-delete',description:`Injection record ${id} deleted`,amountMg:0});return s;});
    setNotice('Injection deleted.');
  };
  const openInjection = (record=null) => {setEditing(record?{...record}:null);setModal('injection');};
  const addSupply = data => {
    if(!data.compound||Number(data.mgPerVial)<=0||Number(data.vials)<=0){setNotice('Enter compound, mg per vial, and a positive vial count.');return;}
    update(s=>{const row={...data,id:uid(),mgPerVial:Number(data.mgPerVial),vials:Number(data.vials),remainingVials:Number(data.vials),remainingMg:Number(data.mgPerVial)*Number(data.vials)};s.supplies.push(row);s.ledger.push({id:uid(),date:data.date||today(),kind:'supply-added',description:`Added ${row.vials} × ${row.mgPerVial} mg ${row.compound}`,amountMg:row.remainingMg,sourceId:row.id});return s;});
    setModal(null);setNotice('Supply batch added.');
  };
  const addVial = data => {
    const mg=Number(data.compoundMg), ml=Number(data.diluentMl);
    if(!data.compound||!data.sourceSupplyId||!(mg>0)||!(ml>0)){setNotice('Choose a source batch and enter positive compound and diluent amounts.');return;}
    const source=state.supplies.find(s=>s.id===data.sourceSupplyId);
    if(!source || mg>source.remainingMg){setNotice('The selected supply batch does not have enough recorded compound remaining.');return;}
    update(s=>{
      const batch=s.supplies.find(x=>x.id===data.sourceSupplyId);
      batch.remainingMg=Math.max(0,batch.remainingMg-mg);
      batch.remainingVials=batch.remainingMg/batch.mgPerVial;
      const row={...data,id:uid(),compoundMg:mg,diluentMl:ml,remainingMg:mg,remainingMl:ml,label:data.label||`${data.compound} vial`,status:'Available'};
      s.preparedVials.push(row);
      s.ledger.push({id:uid(),date:data.preparedDate||today(),kind:'prepare',description:`Allocated ${mg} mg from ${source.batchId||source.compound} to ${row.label}`,amountMg:-mg,sourceId:source.id});
      return s;
    });
    setModal(null);setNotice('Prepared vial saved and supply balance updated.');
  };
  const importFile = async file => {
    if(!file)return;
    try{const rows=await readImportFile(file);setImportRows(rows);setImportName(file.name);setModal('import');}
    catch(e){setNotice(e.message||'Could not read this file.');}
  };
  const commitImport = () => {
    const valid=(importRows||[]).filter(r=>r.date&&r.compound&&r.doseMg!==''&&Number.isFinite(Number(r.doseMg))&&Number(r.doseMg)>=0);
    const skipped=(importRows||[]).length-valid.length;
    let added=0,dupes=0;
    update(s=>{
      valid.forEach(r=>{
        if(s.injections.some(i=>i.date===r.date&&i.compound===r.compound&&Number(i.doseMg)===Number(r.doseMg))){dupes++;return;}
        s.injections.push({id:uid(),date:r.date,compound:r.compound,doseMg:Number(r.doseMg),units:r.units===''?'':Number(r.units),notes:'Imported history'});added++;
      });
      s.ledger.push({id:uid(),date:today(),kind:'import',description:`Imported ${added} history records from ${importName}; skipped ${skipped}, duplicates ${dupes}`,amountMg:0});
      return s;
    });
    setModal(null);setImportRows(null);setNotice(`Import complete: ${added} added, ${dupes} duplicates ignored, ${skipped} invalid rows skipped. Historical import did not change inventory.`);
  };
  const restoreBackup = async file => {
    try{
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data.injections)||!Array.isArray(data.supplies)||!data.settings) throw new Error('This does not look like a Pep Tracker backup.');
      if(!window.confirm('Restore this backup? Current browser data will be replaced.'))return;
      setState({injections:data.injections, supplies:data.supplies||[], preparedVials:data.preparedVials||[], ledger:data.ledger||[], settings:{...loadState().settings,...data.settings}});
      setNotice('Backup restored.');
    }catch(e){setNotice(e.message||'Could not restore backup.');}
  };
  const nav = [
    {id:'review',label:'Data Review',icon:LayoutDashboard},
    {id:'history',label:'Injection Data',icon:ClipboardList},
    {id:'new',label:'New Injection',icon:Syringe},
    {id:'supply',label:'Supply',icon:Package},
    {id:'vials',label:'Prepared Vials',icon:FlaskConical},
    {id:'settings',label:'Settings & Backup',icon:Settings}
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={21}/></div><div><strong>Pep Tracker</strong><small>PERSONAL TRACKER</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(({id,label,icon:Icon})=><button key={id} className={`nav-item ${tab===id?'active':''}`} onClick={()=>{setTab(id);setModal(null);}}><Icon size={18}/><span>{label}</span>{id==='new'&&<Plus className="nav-plus" size={15}/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="local-pill"><span></span> Stored on this device</div><small>Local-first · Private by default</small></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">PEP TRACKER / {nav.find(n=>n.id===tab)?.label.toUpperCase()}</div><h1>{nav.find(n=>n.id===tab)?.label}</h1></div><div className="top-actions"><span className="today-label"><CalendarDays size={15}/>{fmt(today())}</span><button className="theme-toggle" onClick={()=>update(s=>{s.settings.theme=s.settings.theme==='dark'?'light':'dark';return s;})} aria-label="Toggle theme">{state.settings.theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button><button className="primary-button" onClick={()=>openInjection()}><Plus size={17}/> Add injection</button></div></header>
      {notice&&<div className="toast" role="status"><CheckCircle2 size={17}/>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}
      {tab==='review'&&<ReviewPage {...{state,levels,chartData,selectedDate,setSelectedDate,lastFor,nextFor,openInjection,setShowFormulaDetails,showFormulaDetails,setTab}}/>}
      {tab==='history'&&<HistoryPage {...{filtered,search,setSearch,compoundFilter,setCompoundFilter,compounds,openInjection,deleteInjection,importRef,importFile,downloadText,injections}}/>}
      {tab==='new'&&<NewInjectionPage {...{compounds,addInjection}}/>}
      {tab==='supply'&&<SupplyPage {...{state,setModal,update,setNotice}}/>}
      {tab==='vials'&&<VialsPage {...{state,setModal,update,setNotice,openInjection}}/>}
      {tab==='settings'&&<SettingsPage {...{state,setState,setNotice,exportJson,restoreBackup,importRef,update}}/>}
      <footer className="app-footer"><span>Pep Tracker <b>v1.0</b></span><span>Modeled estimates only · Not laboratory results or medical advice</span></footer>
    </main>
    {modal==='injection'&&<InjectionModal key={editing?.id||'new'} record={editing} compounds={compounds} vials={state.preparedVials} onClose={()=>{setModal(null);setEditing(null);}} onSave={addInjection}/>}
    {modal==='supply'&&<SupplyModal onClose={()=>setModal(null)} onSave={addSupply} compounds={compounds}/>}
    {modal==='vial'&&<VialModal onClose={()=>setModal(null)} onSave={addVial} supplies={state.supplies} presets={state.settings.concentrationPresets} compounds={compounds}/>}
    {modal==='import'&&<ImportModal rows={importRows||[]} name={importName} onClose={()=>{setModal(null);setImportRows(null);}} onImport={commitImport}/>}
  </div>;
}

function ReviewPage({state,levels,chartData,selectedDate,setSelectedDate,lastFor,nextFor,openInjection,setShowFormulaDetails,showFormulaDetails,setTab}) {
  const maxDate=today();
  return <div className="page-content">
    <div className="welcome-row"><div><h2>Overview</h2><p>Your recorded history and calculated estimates at a glance.</p></div><button className="secondary-button" onClick={()=>setTab('history')}><ClipboardList size={16}/> View history</button></div>
    <div className="stats-grid">
      {['Reta','Tirz'].map((c,i)=><Stat key={c} label={`${c} modeled level`} value={num(levels[c],3)} sub={`Half-life parameter: ${state.settings.formulas[c]?.halfLifeDays??(i?5:6)} days`} icon={Activity} accent={i?'purple':'blue'}/>)}
      {['Reta','Tirz'].map((c,i)=><Stat key={`${c}-next`} label={`${c} next expected date`} value={fmt(nextFor(c))} sub={lastFor(c)?`Last record: ${fmt(lastFor(c).date)}`:'No injection recorded'} icon={CalendarDays} accent={i?'green':'amber'}/>)}
    </div>
    <section className="panel chart-panel">
      <div className="panel-heading"><div><h2>Modeled levels over time</h2><p>Daily estimates using your configured decay parameters.</p></div><button className="text-button" onClick={()=>setShowFormulaDetails(v=>!v)}>{showFormulaDetails?'Hide':'View'} calculation details <ChevronDown size={15}/></button></div>
      {showFormulaDetails&&<div className="formula-note"><strong>Daily decay sum</strong><code>Σ dose × 2<sup>(−whole days elapsed ÷ half-life days)</sup></code><span>Reta defaults to 6 days; Tirz defaults to 5 days. These are simplified modeled estimates, not measured concentrations or clinical predictions.</span></div>}
      <div className="chart-legend"><span><i className="dot blue"></i>Reta</span><span><i className="dot purple"></i>Tirz</span><span className="chart-unit">Dose-equivalent estimate · mg-like units</span></div>
      <div className="chart-wrap">{chartData.length>0?<ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:8,left:0,bottom:0}}><defs><linearGradient id="retaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#64a8ff" stopOpacity={.24}/><stop offset="100%" stopColor="#64a8ff" stopOpacity={0}/></linearGradient><linearGradient id="tirzFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={.18}/><stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--grid)"/><XAxis dataKey="label" tick={{fill:'var(--muted)',fontSize:11}} axisLine={false} tickLine={false} minTickGap={34}/><YAxis tick={{fill:'var(--muted)',fontSize:11}} axisLine={false} tickLine={false} width={38}/><Tooltip contentStyle={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:10,color:'var(--text)'}} labelStyle={{color:'var(--muted)'}} formatter={(v,n)=>[num(v,3),n]}/><Area type="monotone" dataKey="Reta" stroke="#64a8ff" fill="url(#retaFill)" strokeWidth={2} dot={false}/><Area type="monotone" dataKey="Tirz" stroke="#a78bfa" fill="url(#tirzFill)" strokeWidth={2} dot={false}/></AreaChart></ResponsiveContainer>:<Empty title="No history yet" text="Add or import injections to populate the chart."/>}</div>
      <div className="date-control"><div className="date-control-title"><div><strong>Review a specific day</strong><small>Move the slider or choose a date.</small></div><Field label="Selected date"><input type="date" value={selectedDate} max={maxDate} onChange={e=>setSelectedDate(e.target.value)}/></Field></div><input aria-label="Select day" type="range" min="0" max={Math.max(0,Math.min(365,Math.round((new Date(`${maxDate}T12:00:00`)-new Date(`${(chartData[0]?.date||maxDate)}T12:00:00`))/86400000)))} value={Math.max(0,Math.round((new Date(`${selectedDate}T12:00:00`)-new Date(`${chartData[0]?.date||selectedDate}T12:00:00`))/86400000))} onChange={e=>{const d=new Date(`${chartData[0]?.date||selectedDate}T12:00:00`);d.setDate(d.getDate()+Number(e.target.value));setSelectedDate(d.toISOString().slice(0,10));}}/><div className="slider-labels"><span>{fmt(chartData[0]?.date||selectedDate)}</span><span>{fmt(maxDate)}</span></div></div>
    </section>
    <div className="bottom-grid">
      <section className="panel selected-day"><div className="panel-heading"><div><h2>Selected-day summary</h2><p>{fmt(selectedDate)}</p></div><span className="badge">Calculated</span></div><div className="level-list">{['Reta','Tirz'].map(c=><div className="level-row" key={c}><div className={`compound-mark ${c.toLowerCase()}`}>{c.slice(0,1)}</div><div className="level-name"><strong>{c}</strong><small>Modeled level</small></div><strong className="level-value">{num(calculateLevel(state.injections,c,selectedDate,state.settings.formulas),3)}</strong></div>)}</div><p className="disclaimer"><AlertTriangle size={15}/> Estimates use recorded entries on or before the selected date.</p></section>
      <section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick entry</h2><p>Record an injection without leaving the dashboard.</p></div><span className="panel-icon"><Syringe size={18}/></span></div><button className="quick-add" onClick={()=>openInjection()}><span><Plus size={20}/></span><div><strong>Add an injection</strong><small>Date can be set to today or a past date</small></div><span className="quick-arrow">→</span></button><div className="quick-links"><button onClick={()=>setTab('supply')}><Package size={15}/> Manage supply</button><button onClick={()=>setTab('vials')}><FlaskConical size={15}/> Prepared vials</button></div></section>
    </div>
  </div>;
}
function Empty({title,text}) { return <div className="empty"><div className="empty-icon"><Database size={22}/></div><strong>{title}</strong><span>{text}</span></div>; }

function HistoryPage({filtered,search,setSearch,compoundFilter,setCompoundFilter,compounds,openInjection,deleteInjection,importRef,importFile,downloadText,injections}) {
  return <div className="page-content"><div className="welcome-row"><div><h2>Injection history</h2><p>Review and manage recorded entries. Imports never silently adjust current inventory.</p></div><div className="button-row"><button className="secondary-button" onClick={()=>downloadText(toCsv(injections),'pep-tracker-injections.csv')}><Download size={16}/> Export CSV</button><button className="secondary-button" onClick={()=>importRef.current?.click()}><FileUp size={16}/> Import history</button><input ref={importRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={e=>importFile(e.target.files?.[0])}/><button className="primary-button" onClick={()=>openInjection()}><Plus size={16}/> Add entry</button></div></div>
    <section className="panel table-panel"><div className="table-toolbar"><div className="search-box"><Search size={16}/><input placeholder="Search history..." value={search} onChange={e=>setSearch(e.target.value)}/></div><select value={compoundFilter} onChange={e=>setCompoundFilter(e.target.value)} aria-label="Filter compound"><option>All</option>{compounds.map(c=><option key={c}>{c}</option>)}</select><span className="record-count">{filtered.length} records</span></div>
    {filtered.length?<div className="table-scroll"><table><thead><tr><th>Date</th><th>Compound</th><th>Dose (mg)</th><th>Units</th><th>Notes / source</th><th>Actions</th></tr></thead><tbody>{filtered.map(i=><tr key={i.id}><td>{fmt(i.date)}</td><td><span className={`compound-chip ${i.compound.toLowerCase()}`}>{i.compound}</span></td><td>{num(i.doseMg,3)}</td><td>{i.units===''?'—':num(i.units,3)}</td><td className="muted-cell">{i.notes||'—'}</td><td><div className="row-actions"><IconButton title="Edit injection" onClick={()=>openInjection(i)}><Pencil size={15}/></IconButton><IconButton title="Delete injection" danger onClick={()=>deleteInjection(i.id)}><Trash2 size={15}/></IconButton></div></td></tr>)}</tbody></table></div>:<Empty title="No matching records" text="Add an injection or import your spreadsheet history."/>}
    </section><div className="inline-note"><AlertTriangle size={16}/> Calculated estimates are based on the entered history. Imported records are not linked to prepared vials unless assigned separately.</div></div>;
}
function NewInjectionPage({compounds,addInjection}) {
  return <div className="page-content narrow-page"><div className="welcome-row"><div><h2>Record an injection</h2><p>Add a new record or enter a historical date.</p></div></div><section className="panel form-panel"><InjectionForm compounds={compounds} onSave={addInjection} onCancel={()=>{}}/></section></div>;
}
function InjectionForm({record,compounds,vials=[],onSave,onCancel,compact=false}) {
  const [form,setForm]=useState({date:record?.date||today(),compound:record?.compound||'Reta',doseMg:record?.doseMg??'',units:record?.units??'',preparedVialId:record?.preparedVialId||'',notes:record?.notes||''});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const available=vials.filter(v=>v.status!=='Depleted'&&Number(v.remainingMg)>0);
  return <form className="form-grid" onSubmit={e=>{e.preventDefault();onSave({...form,id:record?.id});}}>
    <Field label="Injection date"><input type="date" value={form.date} max={today()} onChange={e=>set('date',e.target.value)} required/></Field>
    <Field label="Compound"><select value={form.compound} onChange={e=>set('compound',e.target.value)}>{compounds.map(c=><option key={c}>{c}</option>)}</select></Field>
    <Field label="Dose (mg)"><input type="number" min="0" step="any" value={form.doseMg} onChange={e=>set('doseMg',e.target.value)} placeholder="e.g. 5" required/></Field>
    <Field label="Units (optional)"><input type="number" min="0" step="any" value={form.units} onChange={e=>set('units',e.target.value)} placeholder="Syringe units"/></Field>
    <Field label="Prepared vial used (optional)"><select value={form.preparedVialId} onChange={e=>set('preparedVialId',e.target.value)}><option value="">Not assigned / historical</option>{available.filter(v=>v.compound===form.compound).map(v=><option key={v.id} value={v.id}>{v.label} · {num(v.remainingMg)} mg remaining</option>)}</select><small>Assigning a vial records its use against the vial ledger.</small></Field>
    <Field label="Notes (optional)"><input value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Optional notes"/></Field>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit"><CheckCircle2 size={16}/>{record?'Save changes':'Save injection'}</button></div>
  </form>;
}
function InjectionModal({record,compounds,vials,onClose,onSave}) {
  return <Modal title={record?'Edit injection':'Add injection'} onClose={onClose}><InjectionForm record={record} compounds={compounds} vials={vials} onSave={onSave} onCancel={onClose}/></Modal>;
}
function SupplyPage({state,setModal,update,setNotice}) {
  const low=state.supplies.filter(s=>s.remainingMg<=Number(state.settings.lowStockMg));
  return <div className="page-content"><div className="welcome-row"><div><h2>Supply inventory</h2><p>Track source batches and their remaining recorded amounts.</p></div><button className="primary-button" onClick={()=>setModal('supply')}><Plus size={16}/> Add supply batch</button></div>
    {low.length>0&&<div className="alert-banner"><AlertTriangle size={18}/><div><strong>{low.length} batch{low.length===1?'':'es'} at or below low-stock threshold</strong><span>Review inventory and update the threshold in Settings.</span></div></div>}
    <div className="stats-grid two"><Stat label="Supply batches" value={state.supplies.length} sub="Recorded source batches" icon={Package}/><Stat label="Total recorded supply" value={`${num(state.supplies.reduce((n,s)=>n+s.remainingMg,0))} mg`} sub="Across all source batches" icon={Database} accent="green"/></div>
    <section className="panel table-panel"><div className="panel-heading"><div><h2>Supply batches</h2><p>Allocation to prepared vials reduces the source batch balance.</p></div></div>
      {state.supplies.length?<div className="table-scroll"><table><thead><tr><th>Compound / batch</th><th>Received</th><th>mg per vial</th><th>Remaining equivalent</th><th>Expiration</th><th>Status</th><th>Actions</th></tr></thead><tbody>{state.supplies.map(s=><tr key={s.id}><td><strong>{s.compound}</strong><small className="table-sub">{s.batchId||'No batch ID'}</small></td><td>{fmt(s.date)}</td><td>{num(s.mgPerVial)} mg</td><td>{num(s.remainingMg)} mg <small className="table-sub">{num(s.remainingVials,2)} vial equivalents</small></td><td>{s.expiration?fmt(s.expiration):'—'}</td><td><span className={`status ${s.remainingMg<=Number(state.settings.lowStockMg)?'warning':'good'}`}>{s.remainingMg<=0?'Depleted':s.remainingMg<=Number(state.settings.lowStockMg)?'Low stock':'In stock'}</span></td><td><IconButton title="Remove supply batch" danger onClick={()=>{if(window.confirm('Archive/remove this supply batch? Existing ledger entries remain.')){update(x=>{x.supplies=x.supplies.filter(a=>a.id!==s.id);x.ledger.push({id:uid(),date:today(),kind:'batch-removed',description:`Supply batch ${s.batchId||s.id} removed`,amountMg:0,sourceId:s.id});return x;});setNotice('Supply batch removed.');}}}><Trash2 size={15}/></IconButton></td></tr>)}</tbody></table></div>:<Empty title="No supply recorded" text="Add a source batch to begin tracking inventory."/>}
    </section><Ledger ledger={state.ledger}/></div>;
}
function SupplyModal({onClose,onSave,compounds}) {
  const [form,setForm]=useState({compound:'Reta',batchId:'',date:today(),mgPerVial:'',vials:'',expiration:'',notes:''});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return <Modal title="Add supply batch" onClose={onClose}><form className="form-grid" onSubmit={e=>{e.preventDefault();onSave(form);}}><Field label="Compound"><select value={form.compound} onChange={e=>set('compound',e.target.value)}>{compounds.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Batch identifier"><input value={form.batchId} onChange={e=>set('batchId',e.target.value)} placeholder="Optional batch ID"/></Field><Field label="mg per vial"><input type="number" min="0.001" step="any" required value={form.mgPerVial} onChange={e=>set('mgPerVial',e.target.value)}/></Field><Field label="Number of vials"><input type="number" min="0.001" step="any" required value={form.vials} onChange={e=>set('vials',e.target.value)}/></Field><Field label="Date received"><input type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></Field><Field label="Expiration date (optional)"><input type="date" value={form.expiration} onChange={e=>set('expiration',e.target.value)}/></Field><Field label="Notes"><input value={form.notes} onChange={e=>set('notes',e.target.value)}/></Field><div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Save batch</button></div></form></Modal>;
}
function VialsPage({state,setModal,update,setNotice,openInjection}) {
  const total=state.preparedVials.reduce((n,v)=>n+Number(v.remainingMg||0),0);
  return <div className="page-content"><div className="welcome-row"><div><h2>Prepared vials</h2><p>Concentration arithmetic, source-batch traceability, and remaining quantities.</p></div><button className="primary-button" onClick={()=>setModal('vial')}><Plus size={16}/> Add prepared vial</button></div>
    <div className="stats-grid two"><Stat label="Prepared vials" value={state.preparedVials.length} sub="Recorded preparation batches" icon={FlaskConical} accent="purple"/><Stat label="Recorded compound remaining" value={`${num(total)} mg`} sub="Across prepared vials" icon={Activity} accent="green"/></div>
    <section className="panel table-panel"><div className="panel-heading"><div><h2>Prepared vial register</h2><p>Each vial retains its own source and concentration record.</p></div></div>
      {state.preparedVials.length?<div className="table-scroll"><table><thead><tr><th>Vial / compound</th><th>Prepared</th><th>Source batch</th><th>Starting amount</th><th>Concentration</th><th>Remaining</th><th>Status</th><th>Actions</th></tr></thead><tbody>{state.preparedVials.map(v=>{const source=state.supplies.find(s=>s.id===v.sourceSupplyId);const c=calculateConcentration(v.compoundMg,v.diluentMl);return <tr key={v.id}><td><strong>{v.label}</strong><small className="table-sub">{v.compound}</small></td><td>{fmt(v.preparedDate)}</td><td>{source?.batchId||source?.compound||'Source unavailable'}</td><td>{num(v.compoundMg)} mg / {num(v.diluentMl)} mL</td><td>{c?`${num(c,4)} mg/mL`:'—'}</td><td>{num(v.remainingMg)} mg <small className="table-sub">{num(v.remainingMl,2)} mL</small></td><td><span className={`status ${v.remainingMg<=0?'warning':'good'}`}>{v.remainingMg<=0?'Depleted':'Available'}</span></td><td><IconButton title="Mark vial depleted" danger onClick={()=>{if(window.confirm('Mark this vial depleted? This records a manual inventory adjustment.')){update(s=>{const row=s.preparedVials.find(x=>x.id===v.id);row.remainingMg=0;row.remainingMl=0;row.status='Depleted';s.ledger.push({id:uid(),date:today(),kind:'manual-adjustment',description:`${row.label} marked depleted`,amountMg:0,sourceId:row.id});return s;});setNotice('Vial marked depleted.');}}}><Trash2 size={15}/></IconButton></td></tr>;})}</tbody></table></div>:<Empty title="No prepared vials" text="Add a prepared-vial record and link it to a supply batch."/>}
    </section><div className="inline-note"><AlertTriangle size={16}/> The app tracks user-entered amounts and arithmetic only. Confirm preparation instructions and concentration with an appropriate professional.</div><Ledger ledger={state.ledger.filter(l=>l.kind.includes('prepare')||l.kind.includes('injection')||l.kind.includes('manual'))}/></div>;
}
function VialModal({onClose,onSave,supplies,presets,compounds}) {
  const [form,setForm]=useState({label:'',compound:'Reta',sourceSupplyId:'',preparedDate:today(),compoundMg:'',diluentMl:'',target:'',notes:''});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const target=Number(form.target);
  const calculatedVolume=form.target!==''&&Number(form.compoundMg)>0?calculateDiluentVolume(form.compoundMg,target):null;
  const concentration=calculateConcentration(form.compoundMg,form.diluentMl);
  const filtered=supplies.filter(s=>s.compound===form.compound&&s.remainingMg>0);
  return <Modal title="Add prepared vial" onClose={onClose}><form className="form-grid" onSubmit={e=>{e.preventDefault();onSave({...form,diluentMl:form.target!==''?calculatedVolume:form.diluentMl});}}>
    <Field label="Vial label"><input value={form.label} onChange={e=>set('label',e.target.value)} placeholder="e.g. Reta vial 01"/></Field>
    <Field label="Compound"><select value={form.compound} onChange={e=>{set('compound',e.target.value);set('sourceSupplyId','');}}>{compounds.map(c=><option key={c}>{c}</option>)}</select></Field>
    <Field label="Source supply batch"><select required value={form.sourceSupplyId} onChange={e=>set('sourceSupplyId',e.target.value)}><option value="">Select source batch</option>{filtered.map(s=><option key={s.id} value={s.id}>{s.batchId||s.compound} · {num(s.remainingMg)} mg available</option>)}</select></Field>
    <Field label="Preparation date"><input type="date" value={form.preparedDate} onChange={e=>set('preparedDate',e.target.value)}/></Field>
    <Field label="Compound amount (mg)"><input required type="number" min="0.001" step="any" value={form.compoundMg} onChange={e=>set('compoundMg',e.target.value)}/></Field>
    <Field label="Target concentration (optional)"><select value={form.target} onChange={e=>{set('target',e.target.value);if(e.target.value==='')return;const v=calculateDiluentVolume(form.compoundMg,e.target.value);if(v)set('diluentMl',String(v));}}><option value="">Enter diluent volume manually</option>{presets.map((p,i)=><option key={i} value={p.mgMl}>{p.name} · {p.mgMl} mg/mL</option>)}</select></Field>
    <Field label="Diluent volume (mL)" hint="Use a user-verified preparation value."><input required type="number" min="0.001" step="any" value={form.diluentMl} onChange={e=>{set('target','');set('diluentMl',e.target.value);}}/></Field>
    <div className="calculation-card"><span>Calculated concentration</span><strong>{concentration?`${num(concentration,4)} mg/mL`:'— mg/mL'}</strong><small>Compound amount ÷ entered diluent volume</small>{calculatedVolume&&<small>Target calculation: {num(calculatedVolume,4)} mL (review before saving)</small>}</div>
    <Field label="Notes (optional)"><input value={form.notes} onChange={e=>set('notes',e.target.value)}/></Field>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button">Save prepared vial</button></div>
  </form></Modal>;
}
function Ledger({ledger}) {
  const rows=[...ledger].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,12);
  return <section className="panel ledger-panel"><div className="panel-heading"><div><h2>Recent inventory activity</h2><p>Latest recorded movements and audit events.</p></div></div>{rows.length?<div className="ledger-list">{rows.map(r=><div className="ledger-row" key={r.id}><div className="ledger-mark"><Activity size={15}/></div><div><strong>{r.description}</strong><small>{fmt(r.date)} · {r.kind}</small></div><span className={r.amountMg<0?'negative':''}>{r.amountMg?`${r.amountMg>0?'+':''}${num(r.amountMg)} mg`:'—'}</span></div>)}</div>:<Empty title="No activity yet" text="Supply and prepared-vial events will appear here."/>}</section>;
}
function SettingsPage({state,setState,setNotice,exportJson,restoreBackup,update}) {
  const [form,setForm]=useState(()=>JSON.parse(JSON.stringify(state.settings)));
  useEffect(()=>setForm(JSON.parse(JSON.stringify(state.settings))),[state.settings]);
  const setFormula=(c,v)=>setForm(f=>({...f,formulas:{...f.formulas,[c]:{halfLifeDays:v}}}));
  const setInterval=(c,v)=>setForm(f=>({...f,intervals:{...f.intervals,[c]:v}}));
  const setPreset=(i,k,v)=>setForm(f=>({...f,concentrationPresets:f.concentrationPresets.map((p,j)=>j===i?{...p,[k]:v}:p)}));
  return <div className="page-content"><div className="welcome-row"><div><h2>Settings & backups</h2><p>Configure calculations, expected intervals, and protect your local records.</p></div></div>
    <div className="settings-grid"><section className="panel settings-panel"><div className="panel-heading"><div><h2>Calculation parameters</h2><p>Defaults reproduce your spreadsheet's half-life parameters.</p></div></div><div className="settings-form">{['Reta','Tirz'].map(c=><div className="setting-row" key={c}><div><strong>{c} decay parameter</strong><small>Half-life parameter in whole-day decay formula</small></div><Field label="Days"><input type="number" min="0.1" step="any" value={form.formulas[c]?.halfLifeDays??7} onChange={e=>setFormula(c,Number(e.target.value))}/></Field></div>)}
    {['Reta','Tirz'].map(c=><div className="setting-row" key={`${c}-interval`}><div><strong>{c} expected interval</strong><small>Calendar interval in days; not medical guidance</small></div><Field label="Days"><input type="number" min="1" step="1" value={form.intervals[c]??7} onChange={e=>setInterval(c,Number(e.target.value))}/></Field></div>)}
    <div className="setting-row"><div><strong>Low-stock threshold</strong><small>Flag source batches at or below this total mg amount</small></div><Field label="mg"><input type="number" min="0" step="any" value={form.lowStockMg??20} onChange={e=>setForm(f=>({...f,lowStockMg:Number(e.target.value)}))}/></Field></div>
    <h3>Concentration presets</h3>{form.concentrationPresets.map((p,i)=><div className="preset-row" key={i}><input aria-label="Preset name" value={p.name} onChange={e=>setPreset(i,'name',e.target.value)}/><input aria-label="Preset concentration mg per mL" type="number" min="0.001" step="any" value={p.mgMl} onChange={e=>setPreset(i,'mgMl',Number(e.target.value))}/><span>mg/mL</span><IconButton title="Remove preset" danger onClick={()=>setForm(f=>({...f,concentrationPresets:f.concentrationPresets.filter((_,j)=>j!==i)}))}><Trash2 size={15}/></IconButton></div>)}<button className="secondary-button" onClick={()=>setForm(f=>({...f,concentrationPresets:[...f.concentrationPresets,{name:`Custom preset ${f.concentrationPresets.length+1}`,mgMl:1}]}))}><Plus size={15}/> Add preset</button>
    <button className="primary-button wide-button" onClick={()=>{setState(s=>({...s,settings:{...s.settings,...form}}));setNotice('Settings saved.');}}>Save settings</button></div></section>
    <section className="panel settings-panel"><div className="panel-heading"><div><h2>Backup & restore</h2><p>Your data stays in this browser unless you export it.</p></div></div><div className="backup-actions"><button className="backup-card" onClick={()=>exportJson(state)}><span><Download size={20}/></span><strong>Export JSON backup</strong><small>Includes history, supply, prepared vials, settings, and ledger.</small></button><label className="backup-card file-card"><span><Upload size={20}/></span><strong>Restore JSON backup</strong><small>Replace local data with a previously exported backup.</small><input type="file" accept=".json,application/json" onChange={e=>{if(e.target.files?.[0])restoreBackup(e.target.files[0]);e.target.value='';}}/></label><button className="backup-card" onClick={()=>exportJson(state)}><span><RotateCcw size={20}/></span><strong>Create a restore point</strong><small>Download a timestamped backup before major edits.</small></button></div><div className="privacy-box"><CheckCircle2 size={18}/><div><strong>Local-first storage</strong><p>Pep Tracker stores records in browser localStorage and does not send them to a server. Clearing browser data may erase records. Keep backups somewhere safe and private.</p></div></div><button className="danger-button" onClick={()=>{if(window.confirm('Permanently clear all Pep Tracker data in this browser? Export a backup first if needed.')){localStorage.removeItem('pep-tracker-v1');setState(loadState());setNotice('Local data cleared.');}}}><Trash2 size={16}/> Clear all local data</button></section></div>
    <div className="inline-note"><AlertTriangle size={16}/> Estimates are not measured blood concentrations or medical advice. Presets are configurable arithmetic helpers, not recommended preparation targets.</div></div>;
}
function ImportModal({rows,name,onClose,onImport}) {
  const valid=rows.filter(r=>r.date&&r.compound&&r.doseMg!==''&&Number.isFinite(Number(r.doseMg))&&Number(r.doseMg)>=0).length;
  return <Modal title="Preview history import" onClose={onClose}><p className="modal-intro">File: <strong>{name}</strong>. Confirm the rows before importing. Invalid rows are skipped, duplicate date/compound/dose entries are ignored, and historical imports do not adjust inventory.</p><div className="import-summary"><div><strong>{rows.length}</strong><small>Rows detected</small></div><div><strong>{valid}</strong><small>Valid rows</small></div><div><strong>{rows.length-valid}</strong><small>Rows to skip</small></div></div><div className="import-table"><table><thead><tr><th>Row</th><th>Date</th><th>Compound</th><th>Dose</th><th>Units</th><th>Validation</th></tr></thead><tbody>{rows.slice(0,100).map((r,i)=>{const ok=r.date&&r.compound&&r.doseMg!==''&&Number.isFinite(Number(r.doseMg))&&Number(r.doseMg)>=0;return <tr key={i}><td>{r.rowNumber}</td><td>{r.date||'—'}</td><td>{r.compound||'—'}</td><td>{r.doseMg===''?'—':r.doseMg}</td><td>{r.units===''?'—':r.units}</td><td><span className={`status ${ok?'good':'warning'}`}>{ok?'Ready':'Review / skip'}</span></td></tr>;})}</tbody></table>{rows.length>100&&<p className="muted-cell">Showing first 100 rows; all valid rows will be considered.</p>}</div><div className="form-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={onImport} disabled={!valid}><CheckCircle2 size={16}/> Import valid rows</button></div></Modal>;
}
