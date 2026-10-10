'use strict';
function randomIndex(length) {
  if (!Number.isInteger(length) || length < 1 || length > 4294967296) throw new Error('Invalid draw size');
  const limit = Math.floor(4294967296 / length) * length;
  const bytes = new Uint32Array(1);
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return bytes[0] % length;
}
function allocate(players) {
  if (players.length < 2) throw new Error('Add at least 2 players.');
  const shuffled = players.map(p => ({...p}));
  for (let i=shuffled.length-1;i>0;i--) { const j=randomIndex(i+1); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
  return shuffled.map((p,i)=>({...p,purple:i===shuffled.length-1}));
}
const $ = id => document.getElementById(id);
let players=[], nextId=1, busy=false, finished=false, sound=false, audioContext=null, lastResult=[], replaying=false, drawHistory=[];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const intro=$('stage').innerHTML;
function announce(text){$('announcement').textContent=text;}
function renderRoster(){
  $('roster').replaceChildren();
  players.forEach((p,i)=>{const li=document.createElement('li'),num=document.createElement('span'),name=document.createElement('span'),remove=document.createElement('button');num.className='number';num.textContent=String(i+1).padStart(2,'0');name.className='name';name.textContent=p.name;remove.textContent='×';remove.type='button';remove.setAttribute('aria-label',`Remove ${p.name}`);remove.disabled=busy||finished;remove.onclick=()=>removePlayer(p.id);li.append(num,name,remove);$('roster').append(li)});
  $('count').textContent=players.length;$('empty').hidden=players.length>0;$('throw').disabled=players.length<2||busy||finished;$('names').disabled=busy||finished;document.querySelector('.add').disabled=busy||finished;
  $('hint').textContent=busy?'The draw is in progress.':finished?'Return to the players to prepare another draw.':players.length<2?'Add at least 2 players to begin.':`${players.length} players. 1 purple rock. Equal odds.`;
  if(!busy&&!finished)$('round-label').textContent=players.length?`${players.length} PLAYERS READY`:'AWAITING PLAYERS';
}
function addPlayers(raw){
  if(busy||finished)throw new Error('Return to players before editing the roster.');
  if(typeof raw!=='string')throw new Error('Enter player names as text.');
  const names=raw.split(/[\n,]+/).map(n=>n.trim()).filter(Boolean);
  if(!names.length)throw new Error('Enter at least one name.');
  if(names.some(n=>n.length>60))throw new Error('Keep each name to 60 characters or fewer.');
  const unique=new Set(players.map(p=>p.name.toLocaleLowerCase()));const fresh=[];
  for(const name of names){const key=name.toLocaleLowerCase();if(!unique.has(key)){fresh.push(name);unique.add(key)}}
  if(players.length+fresh.length>100)throw new Error('A draw can hold up to 100 players.');
  players.push(...fresh.map(name=>({id:nextId++,name})));renderRoster();
  const skipped=names.length-fresh.length;$('message').textContent=`${fresh.length} added.${skipped?` ${skipped} duplicate name${skipped===1?'':'s'} skipped; add an initial to distinguish players.`:''}`;return {added:fresh.length,total:players.length};
}
function removePlayer(id){if(busy||finished)throw new Error('The roster is locked during a draw.');const index=players.findIndex(p=>p.id===id);if(index<0)throw new Error('Player not found.');players.splice(index,1);renderRoster();$('message').textContent='Player removed.';return {total:players.length};}
$('names-form').onsubmit=e=>{e.preventDefault();try{addPlayers($('names').value);$('names').value='';$('names').focus()}catch(error){$('message').textContent=error.message}};
function tone(freq,duration=.2,volume=.08,type='sine'){
  if(!sound||!audioContext)return;try{const t=audioContext.currentTime,osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(25,freq*.5),t+duration);gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.02);gain.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+duration+.05)}catch{}}
function initAudio(){try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});}catch{}}
$('sound').onclick=()=>{sound=!sound;if(sound)initAudio();$('sound').textContent=sound?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(sound));};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,reduced?Math.min(ms,350):ms));
function rock(name,kind='concealed'){const node=document.createElement('div');node.className=`rock ${kind}`;const img=document.createElement('img');img.src='assets/rock.png';img.alt='';const label=document.createElement('span');label.textContent=name;node.append(img,label);return node;}
function stageTitle(phase,title){$('stage').replaceChildren();const p=document.createElement('p');p.className='phase';p.textContent=phase;const h=document.createElement('h2');h.textContent=title;$('stage').append(p,h);return h;}
// A fixed 30-second show budget. Each awaited segment is included in the budget.
const SHOW_DURATION=30000;
let timelineScale=1;
const showWait=ms=>wait(ms*timelineScale);
function configureTimeline(count){
  const safeBase=Math.max(180,Math.min(1250,9000/Math.max(1,count-2)));
  // Opening 2800, contestants 2200, mix 5000, cast 2300,
  // final-two 3500, pre-reveal 1600, outro 1800, plus safe reveals.
  const baseline=19200+Math.max(0,count-2)*safeBase;
  timelineScale=SHOW_DURATION/baseline;
  return safeBase;
}
function mixingScene(count){
  scene('THE ROCKS ARE MIXING','Fate is being sealed.','The stones tumble. No one knows their fate.');
  const mixer=document.createElement('div');mixer.className='rock-mixer';mixer.setAttribute('aria-hidden','true');
  const visible=Math.min(count,18);
  for(let i=0;i<visible;i++){
    const stone=rock('','concealed mixing-rock');
    stone.style.setProperty('--i',i);
    stone.style.setProperty('--total',visible);
    stone.style.setProperty('--mix-delay',`${(-i*.17).toFixed(2)}s`);
    mixer.append(stone);
  }
  const ring=document.createElement('div');ring.className='mixer-ring';mixer.append(ring);
  $('stage').append(mixer);
  document.querySelector('.arena').classList.add('mixing');
}
function cinematicSound(kind){
  if(!sound)return;
  if(kind==='rumble'){tone(58,1.8,.12,'sawtooth');tone(38,2,.08,'triangle');}
  if(kind==='safe'){tone(480,.22,.04);tone(720,.15,.025);}
  if(kind==='heartbeat'){tone(65,.32,.14,'triangle');}
  if(kind==='impact'){tone(45,2.5,.18,'sawtooth');tone(95,1.7,.1,'triangle');tone(310,.9,.045);}
}
function scene(phase,title,subtitle){stageTitle(phase,title);if(subtitle){const line=document.createElement('p');line.className='safe-tag';line.textContent=subtitle;$('stage').append(line);} }
function recordHistory(draw){
  const entry={date:new Date().toISOString(),roster:draw.map(p=>p.name),eliminated:draw.find(p=>p.purple).name};
  drawHistory.unshift(entry);drawHistory=drawHistory.slice(0,25);
  try{localStorage.setItem('rocks-v2-history',JSON.stringify(drawHistory));}catch{}
  renderHistory();
}
function renderHistory(){
  const list=$('history');list.replaceChildren();
  if(!drawHistory.length){const li=document.createElement('li');li.textContent='No completed draws yet.';list.append(li);return;}
  drawHistory.forEach(entry=>{const li=document.createElement('li');const name=document.createElement('strong');name.textContent=entry.eliminated;const meta=document.createElement('span');meta.textContent=`${entry.roster.length} players · ${new Date(entry.date).toLocaleString()}`;li.append(name,meta);list.append(li);});
}
async function playSequence(draw){
  const n=draw.length, survivors=draw.filter(p=>!p.purple), eliminated=draw.find(p=>p.purple);
  const safeTime=configureTimeline(n);
  $('stage').classList.remove('finale');document.querySelector('.arena').classList.remove('dramatic');
  $('round-label').textContent='THE ROCKS HAVE BEEN CAST';
  scene('LEAVE IT TO FATE','The council has spoken.','One purple rock. No second chances.');
  cinematicSound('rumble');announce('The rock draw is beginning.');await showWait(2800);
  scene('THE PLAYERS',`${n} souls. One fate.`,draw.map(p=>p.name).join('  ·  '));
  await showWait(2200);
  mixingScene(n); cinematicSound('rumble'); await showWait(5000);
  document.querySelector('.arena').classList.remove('mixing');
  scene('THE ROCKS ARE CAST','Fate is in motion.');
  document.querySelector('.arena').classList.add('casting');
  const grid=document.createElement('div');grid.className='draw-grid';$('stage').append(grid);
  const nodes=draw.map((_,i)=>{const el=rock('?');el.classList.add('thrown');el.style.setProperty('--delay',`${Math.min(i*.045,.7)}s`);grid.append(el);return el;});
  cinematicSound('rumble');await showWait(2300);
  document.querySelector('.arena').classList.remove('casting');
  $('stage').querySelector('h2').textContent='White means another day.';
  const caption=document.createElement('p');caption.className='safe-tag';$('stage').append(caption);
  for(let i=0;i<n-2;i++){
    nodes[i].className='rock white revealed';
    nodes[i].style.setProperty('--reveal-index',String(i));nodes[i].querySelector('span').textContent=draw[i].name;
    caption.textContent=`${draw[i].name} is safe.`;announce(caption.textContent);cinematicSound('safe');await showWait(safeTime);
  }
  const finalists=draw.slice(-2).sort((a,b)=>a.id-b.id);
  scene('TWO REMAIN','Only one stays.',finalists.map(p=>p.name).join('   VS   '));
  const suspense=rock('?','concealed final-rock');$('stage').append(suspense);
  document.querySelector('.arena').classList.add('dramatic');
  announce(`Two players remain: ${finalists.map(p=>p.name).join(' and ')}.`);
  for(let i=0;i<4;i++){cinematicSound('heartbeat');await showWait(875);}
  $('stage').querySelector('h2').textContent='The purple rock belongs to…';await showWait(1600);
  $('stage').replaceChildren();$('stage').classList.add('finale');
  document.querySelector('.arena').classList.add('elimination-flash');
  setTimeout(()=>document.querySelector('.arena').classList.remove('elimination-flash'),1800);
  const label=document.createElement('p');label.className='out-label';label.textContent='ELIMINATED';
  const finalRock=rock(eliminated.name,'purple final-rock');
  const title=document.createElement('h2');title.className='result-name';title.textContent=eliminated.name;
  const farewell=document.createElement('p');farewell.className='safe-tag';farewell.textContent='THE ROCKS HAVE SPOKEN';
  $('stage').append(label,finalRock,title,farewell);cinematicSound('impact');
  const details=document.createElement('details');details.className='survivors';
  const summary=document.createElement('summary');summary.textContent=`${n-1} safe on white rocks`;
  const list=document.createElement('div');list.className='safe-list';survivors.forEach(p=>list.append(rock(p.name,'white')));
  details.append(summary,list);$('stage').append(details);
  $('round-label').textContent='THE DRAW IS COMPLETE';
  announce(`${eliminated.name} drew the purple rock and is eliminated.`);
  await showWait(1800);
  return {eliminated:eliminated.name,safe:survivors.map(p=>p.name)};
}
async function throwRocks(){
  if(busy||finished)throw new Error('Return to players before another draw.');
  const draw=allocate(players);lastResult=draw;busy=true;renderRoster();$('message').textContent='';
  if(sound)initAudio();
  try{const result=await playSequence(draw);finished=true;recordHistory(draw);return result;}
  finally{busy=false;$('replay').hidden=!finished;$('reset').hidden=!finished;renderRoster();}
}
async function replayDraw(){
  if(busy||!finished||!lastResult.length)return;
  busy=true;$('replay').disabled=true;$('reset').disabled=true;renderRoster();
  try{if(sound)initAudio();await playSequence(lastResult);}
  finally{busy=false;$('replay').disabled=false;$('reset').disabled=false;renderRoster();}
}
$('replay').onclick=()=>replayDraw().catch(error=>$('message').textContent=error.message);
$('fullscreen').onclick=async()=>{try{if(!document.fullscreenElement)await document.querySelector('.arena').requestFullscreen();else await document.exitFullscreen();}catch(error){$('message').textContent='Presentation mode unavailable: '+error.message;}};
$('clear-history').onclick=()=>{if(!confirm('Clear all locally saved draw history?'))return;drawHistory=[];try{localStorage.removeItem('rocks-v2-history');}catch{}renderHistory();};
try{const saved=JSON.parse(localStorage.getItem('rocks-v2-history')||'[]');if(Array.isArray(saved))drawHistory=saved.filter(e=>e&&typeof e.eliminated==='string'&&Array.isArray(e.roster)&&typeof e.date==='string').slice(0,25);}catch{}renderHistory();
$('throw').onclick=()=>throwRocks().catch(error=>{$('message').textContent=error.message;busy=false;renderRoster()});
function resetDraw(){if(busy)throw new Error('Wait for the current reveal to finish.');finished=false;lastResult=[], replaying=false;$('stage').classList.remove('finale');$('stage').innerHTML=intro;document.querySelector('.arena').classList.remove('dramatic');$('reset').hidden=true;$('replay').hidden=true;renderRoster();$('names').focus();$('message').textContent='All names retained. Remove anyone not in the next draw.';return {players:players.length};}
$('reset').onclick=resetDraw;renderRoster();
if(document.modelContext?.registerTool){const tools=[{name:'read_rocks_draw',description:'Read the roster and completed results; never reveals an in-progress outcome.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({players:players.map(p=>({...p})),busy,finished,result:finished?lastResult:[]})},{name:'add_rocks_players',description:'Add player names separated by lines or commas to the editable roster.',inputSchema:{type:'object',properties:{names:{type:'string'}},required:['names'],additionalProperties:false},execute:input=>addPlayers(input.names)},{name:'remove_rocks_player',description:'Remove a player from the editable roster by their ID.',inputSchema:{type:'object',properties:{id:{type:'integer'}},required:['id'],additionalProperties:false},execute:input=>removePlayer(input.id)},{name:'throw_rocks',description:'Lock the current roster, randomly assign exactly one purple rock, and play the elimination reveal.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:throwRocks},{name:'reset_rocks_draw',description:'Return to roster editing after a completed draw, retaining all player names.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:resetDraw}];for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{})}catch{}}}
