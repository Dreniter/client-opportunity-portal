const {createClient}=window.supabase;

const db=createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("en-US",{
  style:"currency",
  currency:"USD",
  maximumFractionDigits:0
}).format(n);

const TOKEN_KEY="client_opportunity_device_token";

function token(){
  let t=localStorage.getItem(TOKEN_KEY);
  if(!t){
    t=crypto.randomUUID()+crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY,t);
  }
  return t;
}

async function register(){
  const {error}=await db.rpc("register_device",{p_device_token:token()});
  if(error) throw error;
}

/* Growth is calculated first. Insurance is added only at the very end. */
function calc(net,age,rate,death=0){
  const growthProjection=net*Math.pow(
    1+rate/100,
    Math.max(0,80-age)
  );

  return {
    growthProjection,
    finalProjection:growthProjection+death
  };
}

function preview(){
  const a=+$("current_age").value;
  const n=+$("current_net_worth").value;
  const r=+$("growth_rate").value;
  const death=+$("life_insurance_death_benefit").value||0;

  if(!a||n<0||r<0){
    $("projected-preview").textContent="$0";
    $("projection-note").textContent="Enter age and net worth to preview.";
    return;
  }

  const {growthProjection,finalProjection}=calc(n,a,r,death);

  $("projected-preview").textContent=money(finalProjection);
  $("projection-note").textContent=
    `${Math.max(0,80-a)} years projected at ${r}% annual growth, then ${money(death)} life insurance added at the end.`;
}

[
  "current_age",
  "current_net_worth",
  "growth_rate",
  "life_insurance_death_benefit"
].forEach(id=>$(id).addEventListener("input",preview));

document.querySelectorAll(".tab").forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    $(b.dataset.tab).classList.add("active");

    if(b.dataset.tab==="past-clients") load();
  };
});

$("clear-btn").onclick=()=>{
  $("client-form").reset();
  $("growth_rate").value=4;
  $("result").className="result hidden";
  $("form-message").textContent="";
  preview();
};

/* Browser-safe sound effects. They run from the Save button's user interaction. */
function playTone(frequency,duration,delay=0,type="sine",volume=0.08){
  try{
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext) return;

    if(!window.appAudio) window.appAudio=new AudioContext();
    const ctx=window.appAudio;

    const start=ctx.currentTime+delay;
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();

    osc.type=type;
    osc.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(0.0001,start);
    gain.gain.exponentialRampToValueAtTime(volume,start+0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start+duration+0.02);
  }catch(_){}
}

function playGoodSound(){
  playTone(660,0.12,0,"sine",0.06);
  playTone(880,0.16,0.13,"sine",0.06);
}

function playAlertSound(){
  playTone(880,0.14,0,"square",0.08);
  playTone(660,0.14,0.18,"square",0.08);
  playTone(880,0.14,0.36,"square",0.08);
  playTone(660,0.14,0.54,"square",0.08);
}

$("client-form").onsubmit=async e=>{
  e.preventDefault();

  /* Start the audio context during the user's click so browser autoplay rules allow it. */
  try{
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(AudioContext){
      if(!window.appAudio) window.appAudio=new AudioContext();
      if(window.appAudio.state==="suspended") await window.appAudio.resume();
    }
  }catch(_){}

  $("save-btn").disabled=true;
  $("form-message").textContent="Saving client...";

  try{
    await register();

    const age=+$("current_age").value;
    const net=+$("current_net_worth").value;
    const rate=+$("growth_rate").value;
    const death=+$("life_insurance_death_benefit").value||0;

    const {growthProjection,finalProjection}=calc(net,age,rate,death);
    const high=finalProjection>14000000;

    const {error}=await db.rpc("save_client",{
      p_device_token:token(),
      p_full_name:$("full_name").value.trim(),
      p_phone_number:$("phone_number").value.trim(),
      p_current_age:age,
      p_life_insurance_death_benefit:death,
      p_current_net_worth:net,
      p_growth_rate:rate,
      p_projected_net_worth:finalProjection,
      p_high_net_worth:high
    });

    if(error) throw error;

    $("form-message").textContent="Client saved successfully.";

    $("result").className=`result ${high?"alert-result":"good-result"}`;

    $("result").innerHTML=high
      ? `<strong>High net worth client detected!</strong>
         <span>Growth projection at age 80: ${money(growthProjection)}</span>
         <span>Life insurance added at the end: ${money(death)}</span>
         <small>Final projected net worth: ${money(finalProjection)}</small>`
      : `<strong>Good news!</strong>
         <span>Talk to the host for a special opportunity available to only a select few... including you!</span>
         <span>Growth projection at age 80: ${money(growthProjection)}</span>
         <span>Life insurance added at the end: ${money(death)}</span>
         <small>Final projected net worth: ${money(finalProjection)}</small>`;

    if(high) playAlertSound();
    else playGoodSound();

  }catch(err){
    $("form-message").textContent="Could not save: "+err.message;
  }finally{
    $("save-btn").disabled=false;
  }
};

async function load(){
  const list=$("clients-list");
  list.innerHTML='<div class="empty-state">Loading saved clients...</div>';

  try{
    await register();

    const {data,error}=await db.rpc("get_clients",{
      p_device_token:token()
    });

    if(error) throw error;

    window.clients=data||[];
    render();
  }catch(e){
    list.innerHTML=`<div class="empty-state error-text">Could not load clients: ${e.message}</div>`;
  }
}

function render(){
  const q=$("search").value.toLowerCase().trim();
  const f=$("filter").value;

  const arr=window.clients.filter(c=>
    (!q ||
      c.full_name.toLowerCase().includes(q) ||
      c.phone_number.toLowerCase().includes(q)
    ) &&
    (
      f==="all" ||
      (f==="high"?c.high_net_worth:!c.high_net_worth)
    )
  );

  if(!arr.length){
    $("clients-list").innerHTML='<div class="empty-state">No matching clients.</div>';
    return;
  }

  $("clients-list").innerHTML=arr.map(c=>`
    <button class="client-row" data-id="${c.id}">
      <div class="client-main">
        <strong>${esc(c.full_name)}</strong>
        <span>${esc(c.phone_number)} · Age ${c.current_age}</span>
      </div>
      <div class="client-value ${c.high_net_worth?"high-value":""}">
        ${money(c.projected_net_worth)}
        <small>${c.high_net_worth?"High net worth":"Projected at 80"}</small>
      </div>
    </button>
  `).join("");

  document.querySelectorAll(".client-row").forEach(r=>{
    r.onclick=()=>show(window.clients.find(c=>c.id===r.dataset.id));
  });
}

function show(c){
  $("detail-name").textContent=c.full_name;

  $("detail-content").innerHTML=`
    <div><span>Phone</span><strong>${esc(c.phone_number)}</strong></div>
    <div><span>Current age</span><strong>${c.current_age}</strong></div>
    <div><span>Life insurance death benefit</span><strong>${money(c.life_insurance_death_benefit)}</strong></div>
    <div><span>Current net worth</span><strong>${money(c.current_net_worth)}</strong></div>
    <div><span>Annual growth rate</span><strong>${c.growth_rate}%</strong></div>
    <div><span>Final projected net worth at 80</span><strong>${money(c.projected_net_worth)}</strong></div>
    <div><span>Saved</span><strong>${new Date(c.created_at).toLocaleString()}</strong></div>
    <div><span>Status</span><strong class="${c.high_net_worth?"high-value":""}">${c.high_net_worth?"High net worth client":"Standard"}</strong></div>
  `;

  $("details-modal").classList.remove("hidden");
}

function esc(v){
  return String(v).replace(/[&<>"']/g,c=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[c]));
}

/* CSV export is directly importable into Google Sheets. */
function csvValue(value){
  let s=String(value??"");
  if(/^[=+\-@]/.test(s)) s="'"+s;
  return `"${s.replace(/"/g,'""')}"`;
}

function exportForGoogleSheets(){
  if(!window.clients || !window.clients.length){
    $("form-message").textContent="No saved clients to export.";
    return;
  }

  const headers=[
    "Name",
    "Phone",
    "Current Age",
    "Life Insurance Death Benefit",
    "Current Net Worth",
    "Annual Growth Rate (%)",
    "Final Projected Net Worth at 80",
    "High Net Worth",
    "Saved"
  ];

  const rows=window.clients.map(c=>[
    c.full_name,
    c.phone_number,
    c.current_age,
    c.life_insurance_death_benefit,
    c.current_net_worth,
    c.growth_rate,
    c.projected_net_worth,
    c.high_net_worth?"Yes":"No",
    new Date(c.created_at).toLocaleString()
  ]);

  const csv="\uFEFF"+
    [headers,...rows]
      .map(row=>row.map(csvValue).join(","))
      .join("\r\n");

  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");

  a.href=url;
  a.download=`past-clients-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  const btn=$("export-btn");
  if(btn){
    const oldText=btn.textContent;
    btn.textContent="Exported ✓";
    setTimeout(()=>btn.textContent=oldText,1800);
  }
}

$("modal-close").onclick=()=>$("details-modal").classList.add("hidden");
$("details-modal").querySelector(".modal-backdrop").onclick=()=>$("details-modal").classList.add("hidden");
$("refresh-btn").onclick=load;
$("search").oninput=render;
$("filter").onchange=render;

const exportBtn=document.getElementById("export-btn");
if(exportBtn) exportBtn.onclick=exportForGoogleSheets;

preview();
