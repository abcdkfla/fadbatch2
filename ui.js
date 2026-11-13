(() => {
  'use strict';
  const model=window.FedBatch, $=id=>document.getElementById(id), fmt=(v,n=2)=>v==null?'—':v.toFixed(n);
  const series={x:['균체 농도','g/L'],s:['잔류 글루코스','g/L'],volume:['부피','L'],doPct:['DO','%'],otr:['OTR','mmol/L/h'],mu:['비성장속도','1/h']};
  const keys=['t','x','s','volume','mu','doPct','otr','kla','flow'];
  let result,cursor=0;
  for(const [k,values] of Object.entries(model.options)){
    for(const v of values) $(k).add(new Option(k==='volume'?v.toFixed(1):v,v));
  }
  for(const [k,[label]] of Object.entries(series)) $('series').add(new Option(label,k));
  $('mu').value='.2'.replace(/^\./,'0.'); $('rpm').value='1200'; $('volume').value='1';
  $('vvm').value='1';
  function params(){return Object.fromEntries(['mu','rpm','volume','threshold','feed','vvm'].map(k=>[k,$(k).valueAsNumber??Number($(k).value)]));}
  const cells=values=>values.map(v=>'<td>'+v+'</td>').join('');
  const sample=row=>keys.map(k=>k==='flow'?row[k]*1000:row[k]);
  function run(){
    if(!$('setup').reportValidity()) return;
    try {
      const p=params();
      result=model.simulate(p);
      const ranked=model.compare(p), best=ranked[0], e=result.end;
      const tied=ranked.filter(r=>r.end.yield!==null && Math.abs(r.end.yield-best.end.yield)<1e-7);
      $('best').textContent=best.end.yield===null?'비교 가능한 수율이 없습니다.':
        '모델 수율 최고: '+tied.map(r=>r.threshold).join(' · ')+' g/L ('+fmt(best.end.yield,4)+' g/g)';
      $('ranking').innerHTML=ranked.map(r=>'<tr>'+cells([r.threshold,fmt(r.feedAt),fmt(r.end.t),fmt(r.end.mass),fmt(r.end.yield,4),'<button class="btn sm" type="button" data-threshold="'+r.threshold+'">적용</button>'])+'</tr>').join('');
      const metrics=[['균체 농도',fmt(e.x),'g/L'],['총 균체량',fmt(e.mass),'g'],['겉보기 수율',fmt(e.yield,4),'g/g'],['잔류 글루코스',fmt(e.s),'g/L'],['OTR',fmt(e.otr),'mmol/L/h'],['공급 개시',fmt(result.feedAt),result.feedAt==null?'미개시':'h']];
      $('metrics').innerHTML=metrics.map(([k,v,u])=>'<div class="tile"><div class="k">'+k+'</div><div class="v">'+v+'</div><div class="u">'+u+'</div></div>').join('');
      $('end-info').textContent=fmt(e.t)+' h · '+result.reason+' · 종료 시 공기 '+fmt(e.air)+' L/min';
      $('vessel-label').textContent=fmt(e.volume)+' L / 2.50 L';
      const fill=e.volume/2.5*117;
      $('liquid').setAttribute('height',fill); $('liquid').setAttribute('y',167-fill);
      $('samples').innerHTML=result.rows.map(r=>'<tr>'+cells(sample(r).map((v,i)=>fmt(v,i===4?3:2)))+'</tr>').join('');
      cursor=Math.min(cursor,result.rows.length-1); $('time').max=result.rows.length-1;
      graph(); $('run-status').textContent='';
    } catch(error) { $('run-status').textContent=error.message; }
  }
  function graph(){
    const k=$('series').value,[label,unit]=series[k], rows=result.rows;
    const top=Math.max(...rows.map(r=>r[k]),.001)*1.07;
    const x=t=>70+t*32, y=v=>290-253*v/top;
    const r=rows[cursor];
    $('time').value=cursor;
    $('time').setAttribute('aria-valuetext',fmt(r.t)+'시간');
    $('point').textContent=fmt(r.t)+' h · '+label+' '+fmt(r[k],k==='mu'?3:2)+' '+unit;
    const grid=Array.from({length:5},(_,i)=>{const v=i*top/4;return '<path d="M70 '+y(v)+'H838" stroke="#dce5e8"/><text x="62" y="'+(y(v)+4)+'" text-anchor="end">'+fmt(v,k==='mu'?3:1)+'</text>';}).join('');
    const ticks=Array.from({length:7},(_,i)=>'<text x="'+x(i*4)+'" y="318" text-anchor="middle">'+i*4+' h</text>').join('');
    $('graph').innerHTML='<g fill="#536772" font-size="13">'+grid+ticks+'</g><polyline fill="none" stroke="#14736b" stroke-width="3" points="'+rows.map(r=>x(r.t)+','+y(r[k])).join(' ')+'"/><path d="M'+x(r.t)+' 37V290" stroke="#547a7e" stroke-dasharray="4 4"/><circle cx="'+x(r.t)+'" cy="'+y(r[k])+'" r="6" fill="#14736b"/>';
  }
  $('constants').innerHTML=[
    ['μmax / KS','0.44 h⁻¹ / 0.00266 g/L','Monod'],
    ['Y / mS','0.571 g/g / 0.079 g/(g·h)','기질 소비'],
    ['산소 환산','12 mmol/g','첨부 하단의 단일 계수 근사'],
    ['성장·유지 산소 환산','10.5 / 33.4 mmol/g','참고 전용 · 12와 중복 적용하지 않음'],
    ['DCW 환산 / 초기 OD600','0.27 g/L per OD600 / 0.20','초기 균체량 계산 · 환산계수 미검증, 초기 OD는 기존 가정'],
    ['초기 글루코스 / 작업 부피 상한','10 g/L / 2.5 L','고정값'],
    ['장비 정격 / 용기 내경','5 L / 160 mm','장비 참고값 · 모델 부피 상한과 다름'],
    ['공기 유량 / 순산소','선택 vvm × 현재 배양 부피 / 사용 안 함','0.5 / 1 / 2 vvm 중 선택'],
    ['배양기 내부 글루코스','최대 50 g/L','공급 직후 혼합 농도 기준'],
    ['포화 DO / 온도','7.53 mg/L / 30 °C','공기 기준'],
    ['임펠러 / 동력수','Rushton 64 mm × 2단 / 5','동력식'],
    ['단면적 / 통기 동력비 / 밀도','201 cm² / 0.5 / 1000 kg/m³','kLa 계산 · 실제 액량 사용'],
    ['장비 통기 사양','AIR 1–10 L/min / O₂ 0.5–5 L/min','참고 전용']
  ].map(row=>'<tr>'+cells(row)+'</tr>').join('');
  $('setup').addEventListener('submit',e=>{e.preventDefault();run();});
  $('series').addEventListener('change',graph);
  $('time').addEventListener('input',()=>{cursor=Number($('time').value);graph();});
  function seek(e){
    const svg=$('graph'),point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
    const x=point.matrixTransform(svg.getScreenCTM().inverse()).x, t=(x-70)/32;
    cursor=result.rows.reduce((best,r,i)=>Math.abs(r.t-t)<Math.abs(result.rows[best].t-t)?i:best,0);graph();
  }
  $('graph').addEventListener('pointerdown',e=>{$('graph').setPointerCapture(e.pointerId);seek(e);});
  $('graph').addEventListener('pointermove',e=>{if($('graph').hasPointerCapture(e.pointerId))seek(e);});
  $('ranking').addEventListener('click',e=>{
    const btn=e.target.closest('[data-threshold]');if(!btn)return;
    $('threshold').value=btn.dataset.threshold;run();location.hash='overview';
  });
  $('csv').addEventListener('click',()=>{
    const content='\ufeff시간(h),균체(g/L),글루코스(g/L),부피(L),mu(1/h),DO(%),OTR(mmol/L/h),kLa(1/h),공급(mL/h)\r\n'+
      result.rows.map(row=>sample(row).map(v=>v.toFixed(6)).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download='fed-batch-30min.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function route(){
    const pages=[...document.querySelectorAll('main > section')];
    const id=pages.find(p=>'#'+p.id===location.hash)?.id||'overview';
    pages.forEach(p=>p.hidden=p.id!==id);
    document.querySelectorAll('.rail nav a').forEach(a=>a.hash==='#'+id?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
  }
  addEventListener('hashchange',route);run();route();
})();
