// ============================================================
// DB HELPERS (localStorage)
// ============================================================
const DB = {
  getUsers(){ return JSON.parse(localStorage.getItem('b5_users')||'[]'); },
  saveUsers(u){ localStorage.setItem('b5_users',JSON.stringify(u)); },
  getSession(){ return localStorage.getItem('b5_session')||null; },
  setSession(id){ localStorage.setItem('b5_session',id); },
  clearSession(){ localStorage.removeItem('b5_session'); },
  getUser(id){ return this.getUsers().find(u=>u.id===id)||null; },
  completedKey(uid){ return 'b5_completed_'+uid; },
  getCompleted(uid){ return JSON.parse(localStorage.getItem(this.completedKey(uid))||'[]'); },
  addCompleted(uid,ds){
    const d=this.getCompleted(uid);
    if(!d.includes(ds)){d.push(ds);localStorage.setItem(this.completedKey(uid),JSON.stringify(d));}
  },
  healthKey(uid,type){ return 'b5_health_'+uid+'_'+type; },
  getHealth(uid,type){ return JSON.parse(localStorage.getItem(this.healthKey(uid,type))||'[]'); },
  saveHealth(uid,type,arr){ localStorage.setItem(this.healthKey(uid,type),JSON.stringify(arr)); },
  addHealth(uid,type,record){
    const arr=this.getHealth(uid,type); arr.push(record); this.saveHealth(uid,type,arr);
  },
  deleteHealth(uid,type,date){
    const arr=this.getHealth(uid,type).filter(r=>r.date!==date);
    this.saveHealth(uid,type,arr);
  }
};

// ============================================================
// UTILS
// ============================================================
function genId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2); }
function getTodayString(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function calcAge(dob){
  if(!dob) return null;
  const b=new Date(dob),t=new Date();
  let a=t.getFullYear()-b.getFullYear();
  if(t.getMonth()-b.getMonth()<0||(t.getMonth()-b.getMonth()===0&&t.getDate()<b.getDate())) a--;
  return a;
}
function getStreak(dates){
  if(!dates||!dates.length) return 0;
  let streak=0; const c=new Date();
  for(let i=0;i<365;i++){
    const s=c.getFullYear()+'-'+String(c.getMonth()+1).padStart(2,'0')+'-'+String(c.getDate()).padStart(2,'0');
    if(dates.includes(s)){streak++;c.setDate(c.getDate()-1);}
    else if(i===0){c.setDate(c.getDate()-1);}
    else break;
  }
  return streak;
}

// ============================================================
// APP NAVIGATION
// ============================================================
const App = {
  goTo(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id==='screen-home') initHome();
    if(id==='screen-calendar') initCalendar();
    if(id==='screen-mypage') initMyPage();
    if(id==='screen-userselect') renderUserSelect();
    if(id==='screen-health-graph') HGraph.init();
    if(id==='screen-health-wizard') Wizard.start();
  },
  initStart(){
    const users=DB.getUsers(),session=DB.getSession();
    if(session&&DB.getUser(session)){
      // ログイン済み → 今日まだウィザードを出していないか確認
      const uid=session;
      const today=getTodayString();
      const wizKey='b5_wiz_shown_'+uid+'_'+today;
      if(!localStorage.getItem(wizKey)){
        // 今日まだウィザードを出していない → ウィザード起動
        this.goTo('screen-health-wizard');
      } else {
        this.goTo('screen-home');
      }
    } else if(users.length>0){
      this.goTo('screen-userselect');
    } else {
      this.goTo('screen-welcome');
    }
  },
  currentUserId(){ return DB.getSession(); },
  currentUser(){ return DB.getUser(this.currentUserId()); },
  editProfile(){ const u=this.currentUser(); if(u) UserCRUD.openEdit(u); },
  backFromRegister(){
    DB.getUsers().length>0 ? this.goTo('screen-userselect') : this.goTo('screen-welcome');
  }
};

// ============================================================
// AUTH
// ============================================================
const Auth = {
  pendingUserId: null,
  selectUser(userId){
    const user=DB.getUser(userId); if(!user) return;
    this.pendingUserId=userId;
    document.getElementById('login-avatar').textContent=user.avatar||'👤';
    document.getElementById('login-name').textContent=user.name+'さん';
    document.getElementById('login-hint').textContent=
      (user.familyKeys&&user.familyKeys.length>0)?'登録された家族の名前でログインします':'ログインキーが設定されていません';
    const grid=document.getElementById('family-key-grid'); grid.innerHTML='';
    (user.familyKeys||[]).forEach(key=>{
      const chip=document.createElement('button');
      chip.className='family-key-chip'; chip.textContent=key;
      chip.onclick=()=>{
        document.getElementById('login-key-input').value=key;
        document.querySelectorAll('.family-key-chip').forEach(c=>c.classList.remove('selected'));
        chip.classList.add('selected');
      };
      grid.appendChild(chip);
    });
    document.getElementById('login-key-input').value='';
    document.getElementById('login-error').style.display='none';
    App.goTo('screen-login');
  },
  login(){
    const input=document.getElementById('login-key-input').value.trim();
    const user=DB.getUser(this.pendingUserId); if(!user) return;
    const keys=(user.familyKeys||[]).map(k=>k.trim().toLowerCase());
    if(keys.length===0||keys.includes(input.toLowerCase())){
      DB.setSession(user.id); this.pendingUserId=null;
      document.getElementById('login-error').style.display='none';
      App.goTo('screen-home');
    } else {
      document.getElementById('login-error').style.display='block';
    }
  },
  logout(){ DB.clearSession(); App.goTo('screen-userselect'); }
};

// ============================================================
// USER SELECT
// ============================================================
function renderUserSelect(){
  const users=DB.getUsers();
  const container=document.getElementById('user-cards'); container.innerHTML='';
  if(users.length===0){
    container.innerHTML='<p style="text-align:center;color:var(--text-sub);padding:20px">まだ登録がありません</p>';
    return;
  }
  users.forEach(user=>{
    const age=calcAge(user.dob);
    const gl={male:'男性',female:'女性',other:'その他'}[user.gender]||'';
    const streak=getStreak(DB.getCompleted(user.id));
    const card=document.createElement('div'); card.className='user-card';
    card.innerHTML='<div class="user-card-avatar">'+(user.avatar||'👤')+'</div>'+
      '<div class="user-card-info"><div class="user-card-name">'+user.name+'</div>'+
      '<div class="user-card-meta">'+(age!=null?age+'歳':'')+(gl?'・'+gl:'')+' ／ 🔥 '+streak+'日連続</div></div>'+
      '<div class="user-card-arrow">›</div>';
    card.onclick=()=>Auth.selectUser(user.id);
    container.appendChild(card);
  });
}

// ============================================================
// FAMILY KEYS
// ============================================================
let _selectedFamilyKeys=[];
const FamilyKeys={
  getAllKeys(){
    const all=new Set();
    DB.getUsers().forEach(u=>(u.familyKeys||[]).forEach(k=>all.add(k)));
    _selectedFamilyKeys.forEach(k=>all.add(k));
    return [...all];
  },
  renderList(selected){
    _selectedFamilyKeys=[...selected];
    const container=document.getElementById('family-key-list'); container.innerHTML='';
    const allKeys=this.getAllKeys();
    if(allKeys.length===0){
      container.innerHTML='<p style="font-size:12px;color:var(--text-sub)">下の欄から家族の名前を追加してください</p>';
      return;
    }
    allKeys.forEach(key=>{
      const chip=document.createElement('button'); chip.type='button';
      const isSel=_selectedFamilyKeys.includes(key);
      chip.className='family-chip'+(isSel?' selected':'');
      chip.innerHTML=key+' <span class="chip-remove">✕</span>';
      chip.onclick=(e)=>{
        if(e.target.classList.contains('chip-remove')) this.removeKey(key);
        else this.toggleKey(key,chip);
      };
      container.appendChild(chip);
    });
  },
  toggleKey(key,chip){
    if(_selectedFamilyKeys.includes(key)){
      _selectedFamilyKeys=_selectedFamilyKeys.filter(k=>k!==key); chip.classList.remove('selected');
    } else { _selectedFamilyKeys.push(key); chip.classList.add('selected'); }
  },
  removeKey(key){
    const users=DB.getUsers();
    users.forEach(u=>{u.familyKeys=(u.familyKeys||[]).filter(k=>k!==key);});
    DB.saveUsers(users);
    _selectedFamilyKeys=_selectedFamilyKeys.filter(k=>k!==key);
    this.renderList(_selectedFamilyKeys);
  },
  addFromInput(){
    const input=document.getElementById('new-family-input');
    const val=input.value.trim(); if(!val) return;
    if(!_selectedFamilyKeys.includes(val)) _selectedFamilyKeys.push(val);
    input.value=''; this.renderList(_selectedFamilyKeys);
  }
};

// ============================================================
// USER CRUD
// ============================================================
let _selectedGender='',_selectedAvatar='👴';
function selectGender(btn){
  document.querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected'); _selectedGender=btn.dataset.val;
}
function selectAvatar(btn){
  document.querySelectorAll('.avatar-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected'); _selectedAvatar=btn.dataset.val;
}
function updateAgePreview(){
  const dob=document.getElementById('reg-dob').value;
  document.getElementById('age-preview').textContent=dob&&calcAge(dob)!=null?'現在 '+calcAge(dob)+' 歳':'';
}
function showRegError(msg){
  const el=document.getElementById('reg-error'); el.textContent=msg; el.style.display='block';
}

const UserCRUD={
  openNew(){
    document.getElementById('register-title').textContent='プロフィール登録';
    document.getElementById('reg-submit-btn').textContent='登録してアプリを開始';
    document.getElementById('reg-delete-btn').style.display='none';
    document.getElementById('edit-user-id').value='';
    document.getElementById('reg-name').value='';
    document.getElementById('reg-dob').value='';
    document.getElementById('age-preview').textContent='';
    document.getElementById('reg-error').style.display='none';
    _selectedGender=''; _selectedAvatar='👴';
    document.querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('selected'));
    document.querySelectorAll('.avatar-btn').forEach(b=>b.classList.remove('selected'));
    const dflt=document.querySelector('.avatar-btn[data-val="👴"]');
    if(dflt) dflt.classList.add('selected');
    FamilyKeys.renderList([]);
    App.goTo('screen-register');
  },
  openEdit(user){
    document.getElementById('register-title').textContent='プロフィール編集';
    document.getElementById('reg-submit-btn').textContent='変更を保存';
    document.getElementById('reg-delete-btn').style.display='block';
    document.getElementById('edit-user-id').value=user.id;
    document.getElementById('reg-name').value=user.name;
    document.getElementById('reg-dob').value=user.dob||'';
    updateAgePreview();
    document.getElementById('reg-error').style.display='none';
    _selectedGender=user.gender||''; _selectedAvatar=user.avatar||'👴';
    document.querySelectorAll('.gender-btn').forEach(b=>b.classList.toggle('selected',b.dataset.val===_selectedGender));
    document.querySelectorAll('.avatar-btn').forEach(b=>b.classList.toggle('selected',b.dataset.val===_selectedAvatar));
    FamilyKeys.renderList(user.familyKeys||[]);
    App.goTo('screen-register');
  },
  save(){
    const name=document.getElementById('reg-name').value.trim();
    const dob=document.getElementById('reg-dob').value;
    const editId=document.getElementById('edit-user-id').value;
    if(!name){showRegError('お名前を入力してください');return;}
    if(!dob){showRegError('生年月日を入力してください');return;}
    if(_selectedFamilyKeys.length===0){showRegError('家族のキーを1つ以上選んでください');return;}
    const users=DB.getUsers(); let savedId;
    if(editId){
      const idx=users.findIndex(u=>u.id===editId);
      if(idx>=0){
        users[idx]={...users[idx],name,dob,gender:_selectedGender,avatar:_selectedAvatar,familyKeys:[..._selectedFamilyKeys]};
        savedId=editId;
      }
    } else {
      const nu={id:genId(),name,dob,gender:_selectedGender,avatar:_selectedAvatar,familyKeys:[..._selectedFamilyKeys]};
      users.push(nu); savedId=nu.id;
    }
    DB.saveUsers(users); DB.setSession(savedId);
    // 初回登録時はウィザードへ
    const today=getTodayString();
    const wizKey='b5_wiz_shown_'+savedId+'_'+today;
    if(!localStorage.getItem(wizKey)){
      App.goTo('screen-health-wizard');
    } else {
      App.goTo('screen-home');
    }
  },
  confirmDelete(){
    const editId=document.getElementById('edit-user-id').value;
    const user=DB.getUser(editId); if(!user) return;
    if(confirm('「'+user.name+'」のプロフィールを削除しますか？\n運動記録もすべて削除されます。')) this.delete(editId);
  },
  delete(id){
    let users=DB.getUsers().filter(u=>u.id!==id);
    DB.saveUsers(users);
    localStorage.removeItem(DB.completedKey(id));
    ['weight','bp','medicine'].forEach(t=>localStorage.removeItem(DB.healthKey(id,t)));
    if(DB.getSession()===id) DB.clearSession();
    App.goTo(users.length>0?'screen-userselect':'screen-welcome');
  }
};

// ============================================================
// HEALTH HOME & MODAL
// ============================================================
const HealthHome={
  update(){
    const uid=App.currentUserId(); if(!uid) return;
    const today=getTodayString();
    const wArr=DB.getHealth(uid,'weight');
    document.getElementById('home-weight-val').textContent=wArr.length>0?wArr[wArr.length-1].weight:'--';
    const bArr=DB.getHealth(uid,'bp');
    if(bArr.length>0){const l=bArr[bArr.length-1];document.getElementById('home-bp-val').textContent=l.sys+'/'+l.dia;}
    else document.getElementById('home-bp-val').textContent='--/--';
    const mArr=DB.getHealth(uid,'medicine');
    const todayMed=mArr.find(r=>r.date===today);
    const mStatus=document.getElementById('home-medicine-status');
    const mBtn=document.getElementById('home-medicine-btn');
    if(!todayMed){mStatus.textContent='未記録';mBtn.textContent='記録する';mBtn.className='medicine-toggle-btn not-taken';}
    else if(todayMed.taken){mStatus.textContent='服薬済み ✓';mBtn.textContent='✓ 済';mBtn.className='medicine-toggle-btn taken';}
    else{mStatus.textContent='未服薬';mBtn.textContent='飲まなかった';mBtn.className='medicine-toggle-btn not-taken';}
  }
};

let _modalType='weight';
const HealthModal={
  open(type){
    _modalType=type;
    document.getElementById('modal-weight-fields').style.display='none';
    document.getElementById('modal-bp-fields').style.display='none';
    document.getElementById('modal-medicine-fields').style.display='none';
    document.getElementById('modal-save-row').style.display='none';
    if(type==='weight'){
      document.getElementById('modal-title').textContent='体重を記録';
      document.getElementById('modal-weight-fields').style.display='block';
      document.getElementById('modal-save-row').style.display='block';
      document.getElementById('modal-weight-input').value='';
    } else if(type==='bp'){
      document.getElementById('modal-title').textContent='血圧を記録';
      document.getElementById('modal-bp-fields').style.display='block';
      document.getElementById('modal-save-row').style.display='block';
      ['modal-bp-sys','modal-bp-dia','modal-bp-pulse'].forEach(id=>document.getElementById(id).value='');
    } else if(type==='medicine'){
      document.getElementById('modal-title').textContent='服薬を記録';
      document.getElementById('modal-medicine-fields').style.display='block';
    }
    document.getElementById('health-modal').classList.add('open');
  },
  close(){ document.getElementById('health-modal').classList.remove('open'); },
  save(){
    const uid=App.currentUserId(); if(!uid) return;
    const today=getTodayString();
    if(_modalType==='weight'){
      const w=parseFloat(document.getElementById('modal-weight-input').value);
      if(!w||w<20||w>300){alert('体重を正しく入力してください');return;}
      const arr=DB.getHealth(uid,'weight').filter(r=>r.date!==today);
      arr.push({date:today,weight:w}); DB.saveHealth(uid,'weight',arr);
    } else if(_modalType==='bp'){
      const sys=parseInt(document.getElementById('modal-bp-sys').value);
      const dia=parseInt(document.getElementById('modal-bp-dia').value);
      const pulse=parseInt(document.getElementById('modal-bp-pulse').value)||0;
      if(!sys||!dia){alert('最高・最低血圧を入力してください');return;}
      const arr=DB.getHealth(uid,'bp').filter(r=>r.date!==today);
      arr.push({date:today,sys,dia,pulse}); DB.saveHealth(uid,'bp',arr);
    }
    this.close(); HealthHome.update();
    if(document.getElementById('screen-health-graph').classList.contains('active')) HGraph.init();
  },
  saveMedicine(taken){
    const uid=App.currentUserId(); if(!uid) return;
    const today=getTodayString();
    const arr=DB.getHealth(uid,'medicine').filter(r=>r.date!==today);
    arr.push({date:today,taken}); DB.saveHealth(uid,'medicine',arr);
    this.close(); HealthHome.update();
    if(document.getElementById('screen-health-graph').classList.contains('active')) HGraph.init();
  },
  toggleMedicine(){
    const uid=App.currentUserId(); if(!uid) return;
    const today=getTodayString();
    const arr=DB.getHealth(uid,'medicine');
    const existing=arr.find(r=>r.date===today);
    if(!existing) this.open('medicine');
    else{
      const newArr=arr.filter(r=>r.date!==today);
      newArr.push({date:today,taken:!existing.taken});
      DB.saveHealth(uid,'medicine',newArr); HealthHome.update();
    }
  }
};

// ============================================================
// HEALTH GRAPH (Chart.js)
// ============================================================
let _weightChart=null,_bpChart=null,_medChart=null;
const HGraph={
  init(){
    document.querySelectorAll('.hgraph-tab').forEach(t=>t.classList.remove('active'));
    document.getElementById('tab-weight').classList.add('active');
    document.querySelectorAll('.hgraph-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('panel-weight').classList.add('active');
    this.renderWeight();
  },
  switchTab(tab,btn){
    document.querySelectorAll('.hgraph-tab').forEach(t=>t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.hgraph-panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('panel-'+tab).classList.add('active');
    if(tab==='weight') this.renderWeight();
    else if(tab==='bp') this.renderBP();
    else this.renderMedicine();
  },
  renderWeight(){
    const uid=App.currentUserId()||'';
    const arr=DB.getHealth(uid,'weight').slice().sort((a,b)=>a.date.localeCompare(b.date));
    if(arr.length>0){const l=arr[arr.length-1];document.getElementById('weight-latest-val').textContent=l.weight+' kg';document.getElementById('weight-latest-date').textContent=l.date;}
    else{document.getElementById('weight-latest-val').textContent='-- kg';document.getElementById('weight-latest-date').textContent='';}
    const ctx=document.getElementById('chart-weight').getContext('2d');
    if(_weightChart){_weightChart.destroy(); _weightChart=null;}
    _weightChart=new Chart(ctx,{
      type:'line',
      data:{labels:arr.map(r=>r.date.slice(5)),datasets:[{label:'体重(kg)',data:arr.map(r=>r.weight),borderColor:'#4CAF84',backgroundColor:'rgba(76,175,132,0.1)',tension:0.3,pointRadius:4,fill:true}]},
      options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:false}}}
    });
    const hist=document.getElementById('history-weight'); hist.innerHTML='';
    if(arr.length===0){hist.innerHTML='<div class="hgraph-empty">まだ記録がありません</div>';return;}
    [...arr].reverse().forEach(r=>{
      const row=document.createElement('div'); row.className='hgraph-history-item';
      row.innerHTML='<span class="hgraph-history-date">'+r.date+'</span><span class="hgraph-history-val">'+r.weight+' kg</span><button class="hgraph-del-btn" onclick="HGraph.del(\'weight\',\''+r.date+'\')">🗑</button>';
      hist.appendChild(row);
    });
  },
  renderBP(){
    const uid=App.currentUserId()||'';
    const arr=DB.getHealth(uid,'bp').slice().sort((a,b)=>a.date.localeCompare(b.date));
    if(arr.length>0){const l=arr[arr.length-1];document.getElementById('bp-latest-val').textContent=l.sys+'/'+l.dia+' mmHg';document.getElementById('bp-latest-date').textContent=l.date+(l.pulse?' 脈拍:'+l.pulse:'');}
    else{document.getElementById('bp-latest-val').textContent='--/-- mmHg';document.getElementById('bp-latest-date').textContent='';}
    const ctx=document.getElementById('chart-bp').getContext('2d');
    if(_bpChart){_bpChart.destroy(); _bpChart=null;}
    _bpChart=new Chart(ctx,{
      type:'line',
      data:{labels:arr.map(r=>r.date.slice(5)),datasets:[
        {label:'最高',data:arr.map(r=>r.sys),borderColor:'#E57373',tension:0.3,pointRadius:3},
        {label:'最低',data:arr.map(r=>r.dia),borderColor:'#5B9BD5',tension:0.3,pointRadius:3},
        {label:'脈拍',data:arr.map(r=>r.pulse||null),borderColor:'#FF8C42',tension:0.3,pointRadius:3,borderDash:[4,4]}
      ]},
      options:{responsive:true,plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:11}}}},scales:{y:{beginAtZero:false}}}
    });
    const hist=document.getElementById('history-bp'); hist.innerHTML='';
    if(arr.length===0){hist.innerHTML='<div class="hgraph-empty">まだ記録がありません</div>';return;}
    [...arr].reverse().forEach(r=>{
      const row=document.createElement('div'); row.className='hgraph-history-item';
      row.innerHTML='<span class="hgraph-history-date">'+r.date+'</span><span class="hgraph-history-val">'+r.sys+'/'+r.dia+(r.pulse?' 脈:'+r.pulse:'')+'</span><button class="hgraph-del-btn" onclick="HGraph.del(\'bp\',\''+r.date+'\')">🗑</button>';
      hist.appendChild(row);
    });
  },
  renderMedicine(){
    const uid=App.currentUserId()||'';
    const arr=DB.getHealth(uid,'medicine');
    const days=30,today=new Date();
    const labels=[],data=[];let takenCount=0;
    for(let i=days-1;i>=0;i--){
      const d=new Date(today); d.setDate(d.getDate()-i);
      const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      labels.push(ds.slice(5));
      const rec=arr.find(r=>r.date===ds);
      const val=rec?(rec.taken?1:0):0;
      data.push(val); if(val) takenCount++;
    }
    const pct=Math.round(takenCount/days*100);
    document.getElementById('med-latest-val').textContent=pct+'%';
    document.getElementById('med-latest-date').textContent='過去30日間 '+takenCount+'/'+days+'日';
    const ctx=document.getElementById('chart-medicine').getContext('2d');
    if(_medChart){_medChart.destroy(); _medChart=null;}
    _medChart=new Chart(ctx,{
      type:'bar',
      data:{labels,datasets:[{label:'服薬',data,backgroundColor:data.map(v=>v?'#4CAF84':'#E0E8E3'),borderRadius:4}]},
      options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{min:0,max:1,ticks:{stepSize:1,callback:v=>v===1?'済':'未'}}}}
    });
    const hist=document.getElementById('history-medicine'); hist.innerHTML='';
    const sorted=[...arr].sort((a,b)=>b.date.localeCompare(a.date));
    if(sorted.length===0){hist.innerHTML='<div class="hgraph-empty">まだ記録がありません</div>';return;}
    sorted.forEach(r=>{
      const row=document.createElement('div'); row.className='hgraph-history-item';
      row.innerHTML='<span class="hgraph-history-date">'+r.date+'</span><span class="hgraph-history-val">'+(r.taken?'💊 服薬済み':'✕ 未服薬')+'</span><button class="hgraph-del-btn" onclick="HGraph.del(\'medicine\',\''+r.date+'\')">🗑</button>';
      hist.appendChild(row);
    });
  },
  del(type,date){
    if(!confirm(date+'のデータを削除しますか？')) return;
    DB.deleteHealth(App.currentUserId(),type,date);
    if(type==='weight') this.renderWeight();
    else if(type==='bp') this.renderBP();
    else this.renderMedicine();
    HealthHome.update();
  }
};

// ============================================================
// HOME & MY PAGE
// ============================================================
const COACH_MSG={
  morning:['おはようございます！今日も5分だけ体を動かしましょう。','今日も一歩前進！5分の積み重ねが健康寿命を延ばします。','今朝の体調はいかがですか？まずは軽く体を動かしましょう。'],
  afternoon:['こんにちは！午後の5分運動で、体をリフレッシュしましょう。','一日の折り返し地点。5分動いて午後も元気に過ごしましょう！','体を動かすと気分も上がります。今すぐ5分、一緒にやりましょう。'],
  evening:['お疲れさまです。今日の5分運動で一日を締めくくりましょう。','夕方の軽い運動は睡眠の質を上げますよ。5分だけ試してみましょう。','今日も一日よく頑張りました。最後に5分だけ体をほぐしましょう。']
};

function initHome(){
  const user=App.currentUser(); if(!user){App.initStart();return;}
  document.getElementById('home-avatar').textContent=user.avatar||'👤';
  document.getElementById('home-username').textContent=user.name+'さん';
  const h=new Date().getHours();
  const msgs=h<12?COACH_MSG.morning:h<17?COACH_MSG.afternoon:COACH_MSG.evening;
  document.getElementById('coach-message').textContent=msgs[Math.floor(Math.random()*msgs.length)];
  const dates=DB.getCompleted(user.id);
  document.getElementById('streak-count').textContent=getStreak(dates);
  const today=getTodayString();
  const doneToday=dates.includes(today);
  const mp=new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
  const mc=dates.filter(d=>d.startsWith(mp)).length;
  document.getElementById('calendar-summary').textContent=doneToday?'今日完了済み ✓ 今月'+mc+'日達成':'今月'+mc+'日達成';
  document.querySelector('.btn-exercise').style.opacity=doneToday?'0.6':'1';
  document.getElementById('exercise-card-sub').textContent=doneToday?'今日は完了済みです ✓':'AIがメニューを提案します';
  HealthHome.update();
}

function initMyPage(){
  const user=App.currentUser(); if(!user) return;
  document.getElementById('mypage-avatar').textContent=user.avatar||'👤';
  document.getElementById('mypage-name').textContent=user.name;
  const age=calcAge(user.dob);
  const gl={male:'男性',female:'女性',other:'その他'}[user.gender]||'';
  document.getElementById('mypage-age').textContent=[age!=null?age+'歳':'',gl].filter(Boolean).join('・');
  const dates=DB.getCompleted(user.id);
  document.getElementById('mypage-streak').textContent=getStreak(dates);
  document.getElementById('mypage-total').textContent=dates.length;
}

function setActiveNav(btn){
  btn.closest('.bottom-nav').querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

// ============================================================
// EXERCISE LOGIC
// ============================================================
const EXERCISES={
  good:[
    {icon:'🪑',name:'椅子スクワット',desc:'椅子の背もたれに軽く手を添え、ゆっくり立ち座りを繰り返します。背筋をまっすぐ保つことがポイントです。',count:'10回',effect:'脚力・バランス',seconds:60},
    {icon:'🦵',name:'片足立ち',desc:'壁の近くに立ち、片足を軽く上げてバランスをとります。左右各20秒を目標に。慣れてきたら目を閉じてやってみましょう。',count:'左右20秒',effect:'バランス・体幹',seconds:40},
    {icon:'🦶',name:'足踏み',desc:'その場で大きく足踏みをします。膝を高く上げて太ももを意識しながら行いましょう。',count:'30秒間',effect:'有酸素・脚力',seconds:30}
  ],
  tired:[
    {icon:'💺',name:'座ったまま足首回し',desc:'椅子に座り、両足首をゆっくり大きく回します。内回し・外回しそれぞれ10回ずつ。',count:'各10回',effect:'むくみ予防・血流',seconds:60},
    {icon:'🙆',name:'肩回し体操',desc:'両手を肩に添えて、肘で大きな円を描くように肩を回します。前回り・後ろ回り各5回。',count:'前後各5回',effect:'肩こり解消',seconds:40},
    {icon:'🧘',name:'深呼吸ストレッチ',desc:'椅子に深く座り、鼻からゆっくり4秒息を吸い、口から8秒かけて吐きます。体の力を抜いてリラックス。',count:'5回',effect:'リラックス・疲労回復',seconds:60}
  ],
  pain:[
    {icon:'🦶',name:'足首体操',desc:'椅子に座ったまま、両足のつま先を上げ下げします。ゆっくり大きく動かしましょう。',count:'20回',effect:'血流改善',seconds:45},
    {icon:'✋',name:'手・指のストレッチ',desc:'両手の指を大きく広げて5秒キープし、ゆっくり握ります。血行を促進します。',count:'10回',effect:'手・指の柔軟性',seconds:40},
    {icon:'😤',name:'腹式呼吸',desc:'お腹に手を当て、息を吸うときにお腹を膨らませ、吐くときにへこませます。腰への負担なし。',count:'5回',effect:'コアの活性化',seconds:50}
  ]
};
const COMPLETE_MSGS=['素晴らしい！今日も5分間よく頑張りました。この積み重ねが大切です。','完璧です！毎日続けることが健康への近道ですよ。','よくやり遂げました！明日もまた一緒に運動しましょう。','今日も一歩前進しました。あなたの体は確実に変わっています。','最高です！この習慣を続ければ、必ず体に変化を感じるでしょう。'];

let currentCondition=null,currentSleep=null,currentMood=null;
let currentExerciseSet=[],currentExerciseIndex=0;
let timerInterval=null,timerRunning=false,timerSeconds=60;

function startHealthCheck(){
  currentCondition=null; currentSleep=null; currentMood=null;
  document.querySelectorAll('.check-option').forEach(b=>b.classList.remove('selected'));
  document.getElementById('start-exercise-btn').disabled=true;
  App.goTo('screen-healthcheck');
}
function selectCondition(val,btn){
  currentCondition=val;
  btn.closest('.check-options').querySelectorAll('.check-option').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected'); checkAllSelected();
}
function selectSleep(val,btn){
  currentSleep=val;
  btn.closest('.check-options').querySelectorAll('.check-option').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected'); checkAllSelected();
}
function selectMood(val,btn){
  currentMood=val;
  btn.closest('.check-options').querySelectorAll('.check-option').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected'); checkAllSelected();
}
function checkAllSelected(){
  document.getElementById('start-exercise-btn').disabled=!(currentCondition&&currentSleep&&currentMood);
}

function goToExercise(){
  const set=EXERCISES[currentCondition]||EXERCISES.good;
  const off=Math.floor((new Date()-new Date(new Date().getFullYear(),0,0))/86400000)%set.length;
  currentExerciseSet=[...set.slice(off),...set.slice(0,off)];
  currentExerciseIndex=0;
  clearInterval(timerInterval); timerRunning=false;
  renderExercise(); App.goTo('screen-exercise');
}
function renderExercise(){
  const ex=currentExerciseSet[currentExerciseIndex];
  const total=currentExerciseSet.length;
  document.getElementById('exercise-number').textContent=(currentExerciseIndex+1)+' / '+total;
  document.getElementById('exercise-icon').textContent=ex.icon;
  document.getElementById('exercise-name').textContent=ex.name;
  document.getElementById('exercise-desc').textContent=ex.desc;
  document.getElementById('exercise-count').textContent=ex.count;
  document.getElementById('exercise-effect').textContent=ex.effect;
  clearInterval(timerInterval); timerRunning=false;
  timerSeconds=ex.seconds;
  document.getElementById('timer-display').textContent=timerSeconds;
  document.getElementById('btn-start-timer').style.display='inline-block';
  document.getElementById('btn-pause-timer').style.display='none';
  updateTimerCircle(timerSeconds,ex.seconds);
  const prog=document.getElementById('exercise-progress'); prog.innerHTML='';
  for(let i=0;i<total;i++){
    const s=document.createElement('div');
    s.className='progress-step'+(i<currentExerciseIndex?' done':i===currentExerciseIndex?' active':'');
    s.textContent=i+1; prog.appendChild(s);
  }
  document.getElementById('btn-prev').disabled=currentExerciseIndex===0;
  const nb=document.getElementById('btn-next');
  nb.textContent=currentExerciseIndex===total-1?'完了 ✓':'次へ →';
  nb.style.background=currentExerciseIndex===total-1?'linear-gradient(135deg,#FF8C42 0%,#E65100 100%)':'';
}
function nextExercise(){
  clearInterval(timerInterval); timerRunning=false;
  if(currentExerciseIndex<currentExerciseSet.length-1){currentExerciseIndex++;renderExercise();}
  else completeExercise();
}
function prevExercise(){
  clearInterval(timerInterval); timerRunning=false;
  if(currentExerciseIndex>0){currentExerciseIndex--;renderExercise();}
}
function startTimer(){
  if(timerRunning) return;
  timerRunning=true;
  const totalSecs=currentExerciseSet[currentExerciseIndex].seconds;
  document.getElementById('btn-start-timer').style.display='none';
  document.getElementById('btn-pause-timer').style.display='inline-block';
  timerInterval=setInterval(()=>{
    timerSeconds--;
    document.getElementById('timer-display').textContent=timerSeconds;
    updateTimerCircle(timerSeconds,totalSecs);
    if(timerSeconds<=0){
      clearInterval(timerInterval); timerRunning=false;
      document.getElementById('btn-pause-timer').style.display='none';
      document.getElementById('timer-display').textContent='✓';
    }
  },1000);
}
function pauseTimer(){
  clearInterval(timerInterval); timerRunning=false;
  document.getElementById('btn-start-timer').style.display='inline-block';
  document.getElementById('btn-pause-timer').style.display='none';
}
function updateTimerCircle(cur,total){
  const pct=((total-cur)/total)*100;
  document.getElementById('timer-circle').style.background='conic-gradient(var(--primary) '+pct+'%,#E0E8E3 '+pct+'%)';
}
function completeExercise(){
  const uid=App.currentUserId();
  DB.addCompleted(uid,getTodayString());
  const dates=DB.getCompleted(uid);
  document.getElementById('streak-complete').textContent=getStreak(dates);
  document.getElementById('total-complete').textContent=dates.length;
  document.getElementById('complete-message').textContent=COMPLETE_MSGS[Math.floor(Math.random()*COMPLETE_MSGS.length)];
  App.goTo('screen-complete');
}
function shareComplete(){
  const streak=getStreak(DB.getCompleted(App.currentUserId()));
  const text='今日も5分運動しました！🏃 '+streak+'日連続達成中！ #Balance5AI #毎日5分';
  if(navigator.share) navigator.share({text});
  else if(navigator.clipboard) navigator.clipboard.writeText(text).then(()=>alert('コピーしました！\n\n'+text));
  else alert(text);
}

// ============================================================
// CALENDAR
// ============================================================
let calendarYear=new Date().getFullYear(),calendarMonth=new Date().getMonth();
function initCalendar(){
  calendarYear=new Date().getFullYear(); calendarMonth=new Date().getMonth(); renderCal();
}
function changeMonth(delta){
  calendarMonth+=delta;
  if(calendarMonth<0){calendarMonth=11;calendarYear--;}
  if(calendarMonth>11){calendarMonth=0;calendarYear++;}
  renderCal();
}
function renderCal(){
  const uid=App.currentUserId();
  const dates=uid?DB.getCompleted(uid):[];
  const today=getTodayString();
  const mn=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  document.getElementById('cal-month-label').textContent=calendarYear+'年'+mn[calendarMonth];
  const grid=document.getElementById('calendar-grid'); grid.innerHTML='';
  const first=new Date(calendarYear,calendarMonth,1).getDay();
  const days=new Date(calendarYear,calendarMonth+1,0).getDate();
  let done=0;
  for(let i=0;i<first;i++){const e=document.createElement('div');e.className='cal-day';grid.appendChild(e);}
  for(let d=1;d<=days;d++){
    const ds=calendarYear+'-'+String(calendarMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const c=document.createElement('div'); c.className='cal-day'; c.textContent=d;
    if(ds===today) c.classList.add('today');
    if(dates.includes(ds)){c.classList.add('done');done++;}
    grid.appendChild(c);
  }
  document.getElementById('cal-done-count').textContent=done;
  document.getElementById('cal-streak').textContent=getStreak(dates);
}

// ============================================================
// HEALTH WIZARD（初回ヒアリング）
// ============================================================
const Wizard = {
  step: 0,            // 現在のステップ (0=体重, 1=血圧, 2=服薬, 3=完了)
  totalSteps: 3,
  data: {             // 入力中のデータ
    weight: 60.0,
    sys: 120,
    dia: 80,
    pulse: 70,
    medicine: null    // true/false/null(未選択)
  },

  // ウィザード開始
  start() {
    this.step = 0;
    this.data = { weight: 60.0, sys: 120, dia: 80, pulse: 70, medicine: null };
    this._updateDots();
    this._showPanel(0);

    // 直接入力欄をピッカー値に同期
    document.getElementById('wiz-weight-direct').value = this.data.weight.toFixed(1);
    document.getElementById('wiz-weight-val').textContent = this.data.weight.toFixed(1);
    document.getElementById('wiz-sys-val').textContent = this.data.sys;
    document.getElementById('wiz-dia-val').textContent = this.data.dia;
    document.getElementById('wiz-pulse-val').textContent = this.data.pulse;
  },

  // ＋／－ボタンで値を変更
  change(field, delta) {
    const limits = {
      weight: { min: 20, max: 200, step: 0.5 },
      sys:    { min: 60, max: 250, step: 1 },
      dia:    { min: 40, max: 150, step: 1 },
      pulse:  { min: 30, max: 200, step: 1 }
    };
    const lim = limits[field];
    let val = this.data[field] + delta;
    val = Math.max(lim.min, Math.min(lim.max, val));
    // 体重は小数点1桁で丸める
    if (field === 'weight') val = Math.round(val * 10) / 10;
    else val = Math.round(val);
    this.data[field] = val;
    const idMap = { weight:'wiz-weight-val', sys:'wiz-sys-val', dia:'wiz-dia-val', pulse:'wiz-pulse-val' };
    const el = document.getElementById(idMap[field]);
    if (el) el.textContent = field === 'weight' ? val.toFixed(1) : val;
    // 体重は直接入力欄も同期
    if (field === 'weight') {
      document.getElementById('wiz-weight-direct').value = val.toFixed(1);
    }
  },

  // 直接入力欄から値を同期
  syncDirect(field) {
    const val = parseFloat(document.getElementById('wiz-weight-direct').value);
    if (!isNaN(val) && val >= 20 && val <= 200) {
      this.data.weight = Math.round(val * 10) / 10;
      document.getElementById('wiz-weight-val').textContent = this.data.weight.toFixed(1);
    }
  },

  // 服薬選択
  selectMedicine(taken) {
    this.data.medicine = taken;
    document.getElementById('wiz-med-yes').classList.toggle('selected', taken === true);
    document.getElementById('wiz-med-no').classList.toggle('selected', taken === false);
    document.getElementById('wiz-med-next').disabled = false;
  },

  // 次へ
  next() {
    this._saveCurrentStep();
    if (this.step < this.totalSteps - 1) {
      this.step++;
      this._updateDots();
      this._showPanel(this.step);
    } else {
      // 最後のステップを保存して完了画面へ
      this._showComplete();
    }
  },

  // 戻る
  back() {
    if (this.step > 0) {
      this.step--;
      this._updateDots();
      this._showPanel(this.step);
    }
  },

  // スキップ（今日のウィザードを終了してホームへ）
  skip() {
    this._markShown();
    App.goTo('screen-home');
  },

  // 完了してホームへ
  finish() {
    this._markShown();
    App.goTo('screen-home');
  },

  // 現在ステップのデータを保存
  _saveCurrentStep() {
    const uid = App.currentUserId();
    if (!uid) return;
    const today = getTodayString();
    if (this.step === 0) {
      // 体重
      const w = this.data.weight;
      if (w >= 20 && w <= 200) {
        const arr = DB.getHealth(uid, 'weight').filter(r => r.date !== today);
        arr.push({ date: today, weight: w });
        DB.saveHealth(uid, 'weight', arr);
      }
    } else if (this.step === 1) {
      // 血圧
      const { sys, dia, pulse } = this.data;
      if (sys >= 60 && dia >= 40) {
        const arr = DB.getHealth(uid, 'bp').filter(r => r.date !== today);
        arr.push({ date: today, sys, dia, pulse });
        DB.saveHealth(uid, 'bp', arr);
      }
    } else if (this.step === 2) {
      // 服薬
      if (this.data.medicine !== null) {
        const arr = DB.getHealth(uid, 'medicine').filter(r => r.date !== today);
        arr.push({ date: today, taken: this.data.medicine });
        DB.saveHealth(uid, 'medicine', arr);
      }
    }
  },

  // 完了画面表示
  _showComplete() {
    this._showPanel('complete');
    const uid = App.currentUserId();
    const today = getTodayString();

    // サマリー表示
    const summary = document.getElementById('wiz-summary');
    summary.innerHTML = '';
    const items = [
      { icon: '⚖️', label: '体重', val: this.data.weight.toFixed(1) + ' kg' },
      { icon: '❤️', label: '血圧', val: this.data.sys + ' / ' + this.data.dia + ' mmHg' },
      { icon: '💊', label: '服薬', val: this.data.medicine === true ? '服薬済み ✓' : this.data.medicine === false ? '未服薬' : '記録なし' }
    ];
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'wiz-summary-item';
      div.innerHTML =
        '<span class="wiz-summary-icon">' + item.icon + '</span>' +
        '<div><div class="wiz-summary-label">' + item.label + '</div>' +
        '<div class="wiz-summary-val">' + item.val + '</div></div>';
      summary.appendChild(div);
    });
  },

  // 今日のウィザード表示済みフラグを保存
  _markShown() {
    const uid = App.currentUserId();
    if (uid) {
      localStorage.setItem('b5_wiz_shown_' + uid + '_' + getTodayString(), '1');
    }
    HealthHome.update();
  },

  // ドット更新
  _updateDots() {
    for (let i = 0; i < this.totalSteps; i++) {
      const dot = document.getElementById('wiz-dot-' + i);
      if (!dot) continue;
      dot.className = 'wiz-step';
      if (i < this.step) dot.classList.add('done');
      else if (i === this.step) dot.classList.add('active');
    }
  },

  // パネル切り替え
  _showPanel(id) {
    // 数字 or 'complete'
    const panels = ['0', '1', '2', 'complete'];
    panels.forEach(p => {
      const el = document.getElementById('wiz-panel-' + p);
      if (el) el.style.display = 'none';
    });
    const target = document.getElementById('wiz-panel-' + id);
    if (target) target.style.display = 'flex';
    // 服薬パネルは次へボタンを初期無効
    if (id === 2) {
      document.getElementById('wiz-med-next').disabled = (this.data.medicine === null);
    }
  }
};

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    if(document.getElementById('screen-splash').classList.contains('active')) App.initStart();
  },3000);
});
