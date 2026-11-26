(function(scope) {
  "use strict";
  const kinds = {"image/jpeg":"image","image/png":"image","image/webp":"image","application/pdf":"document","video/mp4":"video","video/webm":"video"};
  const {path,isPath}=scope.Project318MediaPath || require("./website-media-path.js");
  async function catalog() {
    const items=[];
    for (let from=0;;from+=100) {
      const {data,error}=await scope.supabaseClient.from("website_media").select("id,title,folder,kind,revision,draft,published").order("id").range(from,from+99);
      if (error || !Array.isArray(data)) throw new Error("Could not read the media library. Check your administrator sign-in and retry.");
      items.push(...data);
      if (data.length<100) return items.sort((a,b)=>a.title.localeCompare(b.title));
    }
  }
  function filter(items,search,kind) {
    const words=String(search).trim().toLowerCase().split(/\s+/);
    return items.filter(item=>(!kind || kind===item.kind) && words.every(word=>(item.title+" "+item.folder+" "+item.kind).toLowerCase().includes(word)));
  }
  async function choose(kind) {
    const dialog=document.createElement("dialog");
    dialog.className="media-picker";
    dialog.setAttribute("aria-label","Choose published media");
    dialog.innerHTML='<h3>Choose published media</h3><label>Search by title or folder<input type="search"></label><label>Files<select size="6"></select></label><p role="status">Loading…</p><div><button type="button" data-select disabled>Use selected file</button> <button type="button" data-close>Cancel</button></div>';
    document.body.append(dialog);
    const search=dialog.querySelector("input");
    const options=dialog.querySelector("select");
    const use=dialog.querySelector("[data-select]");
    const status=dialog.querySelector("[role=status]");
    let available=[], selected=null;
    function draw() {
      const matches=filter(available,search.value,kind);
      options.replaceChildren(...matches.map(item=>new Option(item.title+(item.folder ? " · "+item.folder : "")+" ("+item.kind+")",item.id)));
      if (matches.length) options.selectedIndex=0;
      use.disabled=!matches.length;
      status.textContent=matches.length ? "" : "No published files match.";
    }
    search.oninput=draw;
    use.onclick=()=>{ selected=available.find(row=>row.id===options.value); if(selected) dialog.close(); };
    dialog.querySelector("[data-close]").onclick=()=>dialog.close();
    const done=new Promise(resolve=>dialog.addEventListener("close",()=>{dialog.remove();resolve(selected);},{once:true}));
    dialog.showModal();
    catalog().then(items=>{if(dialog.open){available=items.filter(row=>row.published!==null);draw();}}).catch(error=>{if(dialog.open)status.textContent=error.message;});
    return done;
  }

  async function prepareFile(file) {
    const kind=Object.hasOwn(kinds,file?.type) && kinds[file.type];
    if (!kind || !Number.isInteger(file.size) || file.size<=0) throw new Error("Choose a JPG, PNG, WebP, PDF, MP4 or WebM file.");
    const limit=(kind==="video"?50:10)*1024*1024;
    if (file.size>limit) throw new Error(kind==="video"?"Videos must be 50 MB or smaller.":"Images and PDFs must be 10 MB or smaller.");
    const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
    const ascii=(start,length)=>String.fromCharCode(...bytes.slice(start,start+length));
    const signatures={
      "image/jpeg":()=>bytes[0]===255 && bytes[1]===216 && bytes[2]===255,
      "image/png":()=>[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b),
      "image/webp":()=>ascii(0,4)==="RIFF" && ascii(8,4)==="WEBP",
      "application/pdf":()=>ascii(0,5)==="%PDF-",
      "video/mp4":()=>ascii(4,4)==="ftyp",
      "video/webm":()=>[26,69,223,163].every((b,i)=>bytes[i]===b)
    };
    if (!signatures[file.type]()) throw new Error("This file does not match its selected format.");
    if (file.type!=="image/jpeg" || file.size<256*1024 || !scope.createImageBitmap) return file;
    let image;
    try {
      image=await scope.createImageBitmap(file);
      const ratio=Math.min(1,2400/Math.max(image.width,image.height));
      const canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(image.width*ratio));
      canvas.height=Math.max(1,Math.round(image.height*ratio));
      canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
      const smaller=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.87));
      return smaller && smaller.size<file.size ? smaller : file;
    } finally {image?.close();}
  }
  const api={path,isPath,filter,catalog,choose,prepareFile};
  scope.Project318Media=api;
  if(typeof module!=="undefined" && module.exports) module.exports=api;
})(typeof window==="undefined"?globalThis:window);
