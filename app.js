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
let players=[], nextId=1, busy=false, finished=false, sound=false, audioContext=null, lastResult=[];
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
async function throwRocks(){
  if(busy||finished)throw new Error('Return to players before another draw.');
  const draw=allocate(players);busy=true;renderRoster();$('message').textContent='';$('round-label').textContent='THE ROCKS HAVE BEEN CAST';if(sound)initAudio();
  stageTitle('THE DRAW IS LOCKED','Fate is in motion.');
  const grid=document.createElement('div');grid.className='draw-grid';$('stage').append(grid);
  // Names are deliberately withheld from the DOM until their reveal.
  const nodes=draw.map((_,i)=>{const el=rock('?');el.classList.add('thrown');el.style.setProperty('--delay',`${Math.min(i*.045,.7)}s`);grid.append(el);return el});
  announce('Rocks thrown. The draw is locked.');tone(90,1,.13);await wait(2600);
  const heading=$('stage').querySelector('h2');heading.textContent='White means another day.';
  const caption=document.createElement('p');caption.className='safe-tag';$('stage').append(caption);
  for(let i=0;i<draw.length-2;i++){nodes[i].className='rock white revealed';nodes[i].querySelector('span').textContent=draw[i].name;caption.textContent=`${draw[i].name} is safe.`;announce(caption.textContent);tone(420,.16,.045);await wait(Math.max(180,Math.min(1100,10000/Math.max(1,draw.length-2))));}
  const finalists=draw.slice(-2);const displayOrder=[...finalists].sort((a,b)=>a.id-b.id);
  stageTitle('TWO NAMES. ONE PURPLE ROCK.','Only one stays.');const names=document.createElement('p');names.className='safe-tag';names.textContent=displayOrder.map(p=>p.name).join('  ·  ');$('stage').append(names);const suspense=rock('?','concealed final-rock');$('stage').append(suspense);document.querySelector('.arena').classList.add('dramatic');announce(`Two names remain: ${names.textContent}.`);
  for(let i=0;i<5;i++){tone(62,.22,.17);await wait(150);tone(49,.2,.12);await wait(650-i*70)}
  $('stage').querySelector('h2').textContent='The purple rock belongs to…';await wait(1600);
  const eliminated=finalists.find(p=>p.purple);lastResult=draw;
  $('stage').replaceChildren();$('stage').classList.add('finale');const label=document.createElement('p');label.className='out-label';label.textContent='ELIMINATED';const finalRock=rock(eliminated.name,'purple final-rock');const title=document.createElement('h2');title.className='result-name';title.textContent=eliminated.name;const farewell=document.createElement('p');farewell.className='safe-tag';farewell.textContent='The rocks have spoken.';$('stage').append(label,finalRock,title,farewell);tone(55,2.2,.18,'triangle');tone(110,2,.07);
  const survivors=document.createElement('details');survivors.className='survivors';const summary=document.createElement('summary');summary.textContent=`${draw.length-1} safe on white rocks`;const list=document.createElement('div');list.className='safe-list';draw.filter(p=>!p.purple).forEach(p=>list.append(rock(p.name,'white')));survivors.append(summary,list);$('stage').append(survivors);
  $('round-label').textContent='THE DRAW IS COMPLETE';busy=false;finished=true;$('reset').hidden=false;renderRoster();announce(`${eliminated.name} drew the purple rock and is eliminated. ${draw.filter(p=>!p.purple).map(p=>p.name).join(', ')} safe on white rocks.`);return {eliminated:eliminated.name,safe:draw.filter(p=>!p.purple).map(p=>p.name)};
}
$('throw').onclick=()=>throwRocks().catch(error=>{$('message').textContent=error.message;busy=false;renderRoster()});
function resetDraw(){if(busy)throw new Error('Wait for the current reveal to finish.');finished=false;lastResult=[];$('stage').classList.remove('finale');$('stage').innerHTML=intro;document.querySelector('.arena').classList.remove('dramatic');$('reset').hidden=true;renderRoster();$('names').focus();$('message').textContent='All names retained. Remove anyone not in the next draw.';return {players:players.length};}
$('reset').onclick=resetDraw;renderRoster();
if(document.modelContext?.registerTool){const tools=[{name:'read_rocks_draw',description:'Read the roster and completed results; never reveals an in-progress outcome.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({players:players.map(p=>({...p})),busy,finished,result:finished?lastResult:[]})},{name:'add_rocks_players',description:'Add player names separated by lines or commas to the editable roster.',inputSchema:{type:'object',properties:{names:{type:'string'}},required:['names'],additionalProperties:false},execute:input=>addPlayers(input.names)},{name:'remove_rocks_player',description:'Remove a player from the editable roster by their ID.',inputSchema:{type:'object',properties:{id:{type:'integer'}},required:['id'],additionalProperties:false},execute:input=>removePlayer(input.id)},{name:'throw_rocks',description:'Lock the current roster, randomly assign exactly one purple rock, and play the elimination reveal.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:throwRocks},{name:'reset_rocks_draw',description:'Return to roster editing after a completed draw, retaining all player names.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:resetDraw}];for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{})}catch{}}}
