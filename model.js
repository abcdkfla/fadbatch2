(function(root){
  'use strict';
  const fixed=Object.freeze({muMax:.44,ks:.00266,y:.571,maintenance:.079,odToDcw:.27,
    initialOD:.2,s0:10,volumeMax:2.5,hours:24,brothMax:50,doSat:7.53,density:1000,
    area:.0201,diameter:.064,impellers:2,np:5,gassed:.5,o2:12});
  const options=Object.freeze({mu:[.1,.2,.3,.4],rpm:Array.from({length:12},(_,i)=>(i+1)*100),
    volume:[.5,.6,.7,.8,.9,1],threshold:[5,4,3,2,1],vvm:[.5,1,2]});
  function transfer(rpm,volume,vvm){
    const p0=fixed.np*fixed.density*(rpm/60)**3*fixed.diameter**5*fixed.impellers;
    const pv=p0*fixed.gassed/(volume/1000);
    const air=vvm*volume;
    const vs=(air/60000)/fixed.area;
    const kla=3600*.026*pv**.4*vs**.5;
    return {pv,vs,kla,air,capacity:kla*fixed.doSat/32};
  }
  function simulate(p){
    for(const key of Object.keys(options)) if(!options[key].includes(p[key])) throw Error('선택 범위를 확인해 주세요.');
    if(!(p.feed>5 && p.feed<=800)) throw Error('공급액 농도는 5 초과, 800 g/L 이하여야 합니다.');
    const f=fixed, initialMass=f.initialOD*f.odToDcw*p.volume;
    let t=0,volume=p.volume,mass=initialMass,substrate=f.s0*volume,used=0,feedAt=null,next=.5;
    const rows=[];
    function state(){
      const s=substrate/volume,x=mass/volume, k=transfer(p.rpm,volume,p.vvm);
      const monod=f.muMax*s/(f.ks+s);
      const potential=feedAt===null?monod:Math.min(monod,p.mu);
      const allowed=Math.max(0,(k.capacity/(f.o2*x)-f.maintenance)*f.y);
      const mu=Math.min(potential,allowed);
      const qs=s>0?mu/f.y+f.maintenance:0;
      const uptake=Math.min(k.capacity,f.o2*qs*x);
      const dissolved=Math.max(0,f.doSat-32*uptake/k.kla);
      const flow=s<=p.threshold+1e-8 && t<f.hours-1e-8 && volume<f.volumeMax-1e-8
        ?(p.mu/f.y+f.maintenance)*mass/(p.feed-p.threshold):0;
      return {t,x,s,volume,mu,qs,flow,air:k.air,otr:k.kla*(f.doSat-dissolved)/32,kla:k.kla,
        capacity:k.capacity,doPct:dissolved/f.doSat*100,limited:allowed<potential,used,mass,
        yield:used>0?(mass-initialMass)/used:null};
    }
    rows.push(state());
    while(t<f.hours-1e-8 && volume<f.volumeMax-1e-8){
      const a=state();
      let dt=Math.min(.005,f.hours-t,next-t,a.flow>0?(f.volumeMax-volume)/a.flow:Infinity);
      const consumption=Math.min(a.qs*mass, a.capacity*volume/f.o2);
      if(consumption>0 && a.s>p.threshold+1e-8){
        dt=Math.min(dt,(substrate-p.threshold*volume)/consumption);
      }
      // Before consumption, mixed glucose must remain below the broth limit.
      if(a.flow>0 && p.feed>f.brothMax){
        dt=Math.min(dt,Math.max(0,f.brothMax*volume-substrate)/(a.flow*(p.feed-f.brothMax)));
      }
      const uptake=Math.min(substrate+a.flow*p.feed*dt,consumption*dt);
      volume+=a.flow*dt;
      substrate=Math.max(0,substrate+a.flow*p.feed*dt-uptake);
      mass+=Math.min(a.mu*mass*dt,uptake*f.y);
      used+=uptake;
      t+=dt;
      if(feedAt===null && substrate/volume<=p.threshold+1e-8) feedAt=t;
      if(t>=next-1e-8){t=next;rows.push(state());next+=.5;}
    }
    const end=state();
    if(Math.abs(rows.at(-1).t-end.t)>1e-8) rows.push(end);
    return {rows,end,feedAt,reason:volume>=f.volumeMax-1e-8?'2.5 L 도달':'24시간 도달'};
  }
  function compare(p){
    return options.threshold.map(threshold=>({threshold,...simulate({...p,threshold})}))
      .sort((a,b)=>(b.end.yield??-1)-(a.end.yield??-1)||b.threshold-a.threshold);
  }
  const api={fixed,options,transfer,simulate,compare};
  if(typeof module==='object') module.exports=api; else root.FedBatch=api;
})(globalThis);
