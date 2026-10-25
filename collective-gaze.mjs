// Presentation-only group scheduling; immutable hints and game counts are untouched.
export class CollectiveGaze {
  constructor(random = Math.random) { this.random=random; this.faces=[]; this.collectiveGazeGroups=new Map(); this.activeTarget=null; this.quietUntil=0; this.wasDragging=false; }
  reset() { this.faces.length=0;this.collectiveGazeGroups.clear();this.activeTarget=null;this.quietUntil=0;this.wasDragging=false; }
  interval() { return 5500+this.random()*1000; }
  add(hint,render,getOrigin=null) {
    const face={sourceCell:hint.sourceCell,targetCell:hint.targetCell,normalDirection:{x:hint.dx,y:hint.dy},currentDirection:{x:hint.dx,y:hint.dy},collectiveGaze:false,phase:'idle',render,getOrigin};
    this.faces.push(face);return face;
  }
  endEvent(group,now) {
    group.activeEvent=false;group.focusBugId=null;group.sample=null;group.returnUntil=now+200;
  }
  update(now,surrounded,opened,roaming,dragging,size) {
    const groups=this.collectiveGazeGroups;
    const clusterByTarget=new Map();
    for(const [key,cluster] of surrounded)for(const target of cluster.cells)clusterByTarget.set(target,key);
    for(const group of groups.values())group.faces=[];
    for(const face of this.faces) {
      const target=face.targetCell.row*size+face.targetCell.col;
      face.collectiveGaze=clusterByTarget.has(target);
      if(!face.collectiveGaze)continue;
      const key=clusterByTarget.get(target);
      if(!groups.has(key))groups.set(key,{targetCell:surrounded.get(key).targetCell,faces:[],nextEventTime:now+this.interval(),activeEvent:false,focusBugId:null,eventEndTime:null,returnUntil:0,sample:null});
      groups.get(key).faces.push(face);
    }
    for(const [key,group] of groups)if(!group.faces.length){groups.delete(key);if(this.activeTarget===key)this.activeTarget=null;}
    if(dragging) {
      // Held insects override every group, even during a timed event.
      if(!this.wasDragging)for(const group of groups.values()){group.activeEvent=false;group.focusBugId=null;group.sample=null;group.returnUntil=0;}
      this.activeTarget=null;
    } else {
      if(this.wasDragging) {
        for(const group of groups.values())group.nextEventTime=now+this.interval();
        this.quietUntil=now+200;
      }
      const active=groups.get(this.activeTarget);
      if(active) {
        if(active.activeEvent) {
          const bug=roaming.find(b=>b.id===active.focusBugId);
          if(!bug||now>=active.eventEndTime)this.endEvent(active,now);
          else if(now>=active.nextSampleTime) {
            active.sample={x:bug.x,y:bug.y};active.nextSampleTime=now+150;
          }
        } else if(now>=active.returnUntil) { this.activeTarget=null;this.quietUntil=now+600; }
      }
      if(this.activeTarget===null && now>=this.quietUntil) {
        const due=[...groups.entries()].filter(([,g])=>now>=g.nextEventTime).sort((a,b)=>a[1].nextEventTime-b[1].nextEventTime);
        if(due.length) {
          const [key,group]=due[0];group.nextEventTime=now+this.interval();
          const x=group.targetCell.col+.5,y=group.targetCell.row+.5;
          const bug=roaming.reduce((best,b)=>!best||Math.hypot(b.x-x,b.y-y)<Math.hypot(best.x-x,best.y-y)?b:best,null);
          if(bug) {
            group.activeEvent=true;group.focusBugId=bug.id;group.eventEndTime=now+2000;
            group.sample={x:bug.x,y:bug.y};group.nextSampleTime=now+150;this.activeTarget=key;
          }
        }
      }
    }
    for(const face of this.faces) {
      const target=face.targetCell.row*size+face.targetCell.col,group=groups.get(clusterByTarget.get(target));
      const focus=face.collectiveGaze?(dragging||(group?.activeEvent?group.sample:null)):null;
      const mode=focus?(dragging?'drag':'event'):'idle';
      if(focus) {
        const origin=face.getOrigin?.()||{x:face.sourceCell.col+.5,y:face.sourceCell.row+.5};
        const dx=focus.x-origin.x,dy=focus.y-origin.y,length=Math.max(Math.abs(dx),Math.abs(dy),.001);
        const direction={x:dx/length,y:dy/length};
        if(face.phase!==mode){face.phase=mode;face.started=now;face.lastTrack=now;face.from={...face.currentDirection};}
        const age=now-face.started;
        if(age<=110)face.currentDirection=mix(face.from,direction,age/110);
        else if(dragging)face.currentDirection=mix(face.currentDirection,direction,1-Math.exp(-Math.max(0,now-face.lastTrack)/35));
        else face.currentDirection=direction; // Sampled at 150ms, deliberately not continuous.
        face.lastTrack=now;
      } else {
        if(face.phase==='drag'||face.phase==='event'){face.phase='return';face.from={...face.currentDirection};face.started=now;}
        if(face.phase==='return') {
          const t=Math.min(1,(now-face.started)/200);
          face.currentDirection=mix(face.from,face.normalDirection,t);
          if(t===1){face.phase='idle';face.currentDirection={...face.normalDirection};}
        } else face.currentDirection={...face.normalDirection};
      }
      face.render(face.currentDirection);
    }
    this.wasDragging=!!dragging;
  }
}
function mix(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
