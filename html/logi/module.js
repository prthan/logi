/*[merge-start] ==> module/index.js*/(function(window)
{
  let __package = "logi";
  let __name = "Module";

  class Module
  {
    constructor(options)
    {
      this.options = options;
      this.eventHandlers = {};
    }

    init()
    {
      let module = this;
      
      let impl=async(res$, rej$)=>
      {
        let swreg=await navigator.serviceWorker.register(zn.env.sw);
        console.info("[LOGi]", 'ServiceWorker ==> registered')
        console.info("[LOGi]","module initialized");
        res$();
      }
      console.info("[LOGi]","module initialized");
      //return new Promise(impl);
    }
    
  }

  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = Module;

})(window);

/*[merge-end] <== module/index.js*//*[merge-start] ==> agent/client.js*/(function(window)
{
  let __package = "logi.agent";
  let __name = "Client";

  class AgentClient
  {
    constructor(options)
    {
      this.options=options;
      this.$$={};
    }

    connect()
    {
      let client=this;
      client.socket=io(`${client.options.endpoint}`,{
        path: "/logi/agent",
        withCredentials: true
      });
      client.socket.on("connect", ()=>
      {
        console.info("[APIi]", `connected to agent at ${client.options.endpoint}`);
        console.info("[APIi]", `announcing to agent`);
        client.socket.emit("/logi/announce", {oid: client.options.oid});
      })
      client.socket.on("/logi/announce/ack", (socmsg)=>console.info("[APIi]", `announcing acknowledged by agent`));
      client.socket.on("/logi/receive", (socmsg)=>client.onReceive(socmsg));
      client.socket.on("/logi/fetch", (socmsg)=>client.onFetch(socmsg));
    }

    send(inspection)
    {
      let client=this;
      let impl=($res, $rej)=>
      {
        let oid=zn.shortid();
        inspection["@agentReqId"]=oid;
        client.$$[oid]=$res;
        client.socket.emit("/logi/send", inspection);
      }

      return new Promise(impl);
    }

    onReceive(socmsg)
    {
      let client=this;
      let oid=socmsg["@agentReqId"];
      if(client.$$[oid])
      {
        let $res=client.$$[oid];
        delete client.$$[oid];
        $res(socmsg);
      }
    }

    fetch(url)
    {
      let client=this;
      let impl=($res, $rej)=>
      {
        let oid=zn.shortid();
        let fetchRequest={url: url, "@agentReqId": oid};
        client.$$[oid]=$res;
        client.socket.emit("/logi/fetch", fetchRequest);
      }
      return new Promise(impl);
    }

    onFetch(socmsg)
    {
      let client=this;
      let oid=socmsg["@agentReqId"];
      if(client.$$[oid])
      {
        let $res=client.$$[oid];
        delete client.$$[oid];
        $res(socmsg.res);
      }
    }
  }
  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = AgentClient;  
  
})(window);/*[merge-end] <== agent/client.js*//*[merge-start] ==> io/readline.interface.js*/(function(window)
{
  let __package = "logi.io";
  let __name = "ReadLineInterface";

  class ReadLineInterface
  {
    constructor(file)
    {
      this.file=file;
      this.fileSize=file.size;
      this.chunkSize=1024 * 8;
      this.buffer="";
      this.currentPart=0;
      this.totalParts=Math.floor(this.fileSize / this.chunkSize);
      this.lastPartSize=this.fileSize % this.chunkSize;
      if(this.lastPartSize>0) this.totalParts ++;
    
      this.currentLine=0;
    
    }

    readChunk()
    {
      let rli=this;
      let impl=async(res$, rej$)=>
      {
        if(rli.currentPart==rli.totalParts)
        {
          rli.eof=true;
          res$(null);
          return;
        }
        rli.currentPart++;
        
        let sizeToRead=rli.chunkSize;
        if(rli.currentPart==rli.totalParts) sizeToRead=rli.lastPartSize;
        let offset=(rli.currentPart-1)*rli.chunkSize;
        rli.partBlob=rli.file.slice(offset, offset + sizeToRead);
        let partBlobText=await rli.partBlob.text();
        res$(partBlobText);
        delete rli.partBlob;
      }
    
      return new Promise(impl);
    }

    readLine()
    {
      let rli=this;
      let impl=async(res$, rej$)=>
      {
        let index=rli.buffer.indexOf("\n");
        let currentPartChunk=null;
        while(index==-1)
        {
          currentPartChunk=await rli.readChunk();
          if(currentPartChunk==null) break;
    
          rli.buffer+=currentPartChunk;
          index=rli.buffer.indexOf("\n");
        }
    
        rli.currentLine++;
        if(index!=-1)
        {
          let line=rli.buffer.substr(0, index);
          rli.buffer=rli.buffer.substring(index+1);
          res$(line);
        }
        else if(index==-1 && currentPartChunk==null && rli.buffer=="") res$(null);
        else
        {
          let line=rli.buffer;
          rli.buffer="";
          res$(line);
        }
      }
    
      return new Promise(impl);
    }
    
    metrics()
    {
      let rli=this;
      let metric=
      {
        currentLine: rli.currentLine, 
        totalParts: rli.totalParts, 
        currentPart: rli.currentPart, 
        chunkSize: rli.chunkSize, 
        percent: Math.round(rli.currentPart / rli.totalParts * 100)
      }
      return metric;
    }

    async *[Symbol.asyncIterator]()
    {
      let rli=this;
      let str=await rli.readLine();
      while(str!=null)
      {
        yield str;
        str=await rli.readLine();
      }  
    }
  }
  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = ReadLineInterface;  
  
})(window);/*[merge-end] <== io/readline.interface.js*//*[merge-start] ==> io/wl-log.converter.js*/(function(window)
{
  let __package = "logi.io";
  let __name = "WLLogConverter";

  const DEFAULTS=
  {
    start: "####", 
    record: "####(.|\n)*?> \n",
    tsformat: "MMM DD, YYYY hh:mm:ss,SSS AM",
    fieldMap:{"0": "ts", "1": "level", "2": "component", "3": "host", "4":"managed server", "5": "thread name", "6": "user", "8": "ecid", "9": "logId", "10": "context", "11": "code", "12": "message"},
  }
  
  class WLLogConverter
  {
    constructor(options)
    {
      this.options=options;
      this.dataBuffer="";
    }
    
    async *[Symbol.asyncIterator]()
    {
      let converter=this;
      converter.recordStartMarker=new RegExp(converter.options.recordStartMarker || DEFAULTS.start);
      converter.multiLine=false;

      let rl=new logi.io.ReadLineInterface(converter.options.file);
      for await (let line of rl)
      {
        converter.onprogress && converter.onprogress(rl.metrics());
        let logRecord=converter.handleLineFromFile(line);
        if(logRecord!=null) yield logRecord;
      }
    }

    async process()
    {
      let converter=this;
      converter.recordStartMarker=new RegExp(converter.options.recordStartMarker || DEFAULTS.start);
      converter.multiLine=false;
    
      let rl=new logi.io.ReadLineInterface(converter.options.file);
      for await (let line of rl)
      {
        converter.handleLineFromFile(line);
      }
      converter.ondone && converter.ondone();
    }
    
    handleLineFromFile(line)
    {
      let converter=this;
      let logRecord=null;
      if(!converter.multiLine)
      {
        let startMatch=line.match(converter.recordStartMarker);
        if(startMatch!=null && startMatch.index==0)
        {
          if(converter.dataBuffer!="") console.error("Unparsed data: ", converter.dataBuffer);
          converter.dataBuffer=line + "\n";
          if(!line.endsWith("> ")) converter.multiLine=true;
          else logRecord=converter.processDataBuffer(false);
        }
      }
      else
      {
        converter.dataBuffer += line + "\n";
        if(line.endsWith("> "))
        {
          converter.multiLine=false;
          logRecord=converter.processDataBuffer(true);
        }
      }
    
      return logRecord;
    }
    
    processDataBuffer(multiLine)
    {
      let converter=this;
      let logRecord=converter.handleLogRecord(converter.dataBuffer, multiLine);
      converter.dataBuffer="";

      return logRecord;
    }
    
    handleLogRecord(recordLine, multiLine)
    {
      let converter=this;
      let logRecord=converter.logRecordSplitter(recordLine, converter.options, multiLine);
      logRecord.type=converter.options.type;
      logRecord.source=converter.options.name;
      converter.onrecord && converter.onrecord(logRecord);

      return logRecord;
    }
    
    logRecordSplitter(recordLine, options, multiLine)
    {
      let tsformat=options.tsformat || DEFAULTS.tsformat;
      let l=[recordLine];
      let multiLineMessage="";
      let firstLine=recordLine;
    
      if(multiLine)
      {
        l=recordLine.split("\n");
        firstLine=l.shift();
        multiLineMessage=l.join("\n");
        multiLineMessage=multiLineMessage.substr(0, multiLineMessage.length-3);
      }
      else firstLine=recordLine.substr(0, recordLine.length-3);
    
      let fields=firstLine.split("> <");
      fields[0]=fields[0].substr(5);
      let logRecord=fields.reduce((a,c,i)=>
      {
        if(DEFAULTS.fieldMap[`${i}`]) a[DEFAULTS.fieldMap[`${i}`]]=c;
        return a;
      }, {})
    
      logRecord.ts=moment(logRecord.ts, tsformat).toISOString();
      logRecord.message = logRecord.message + multiLineMessage;
      return logRecord;
    }
  }
  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = WLLogConverter;  
  
})(window);

/*[merge-end] <== io/wl-log.converter.js*//*[merge-start] ==> io/wl-diag-log.converter.js*/(function(window)
{
  let __package = "logi.io";
  let __name = "WLDiagnosticLogConverter";

  const DEFAULTS=
  {
    start: "(\\[\\d{4,4}-\\d{2,2}-\\d{2,2}T.*\\] )", 
    record: "(\\[\\d{4,4}-\\d{2,2}-\\d{2,2}T.*\\] )(\\[.*\\] )+(((.*)\\[\\[(.|\n)*\\]\\]\n)|(([^\\[]*)\n))",
    tsformat: "YYYY-MM-DDThh:mm:ss.SSSZ"
  }
  
  class WLDiagnosticLogConverter
  {
    constructor(options)
    {
      this.options=options;
      this.dataBuffer="";
    }
    
    async *[Symbol.asyncIterator]()
    {
      let converter=this;
      converter.recordStartMarker=new RegExp(converter.options.recordStartMarker || DEFAULTS.start);
      converter.multiLine=false;

      let rl=new logi.io.ReadLineInterface(converter.options.file);
      for await (let line of rl)
      {
        converter.onprogress && converter.onprogress(rl.metrics());
        let logRecord=converter.handleLineFromFile(line);
        if(logRecord!=null) yield logRecord;
      }
    }

    async process()
    {
      let converter=this;
      converter.recordStartMarker=new RegExp(converter.options.recordStartMarker || DEFAULTS.start);
      converter.multiLine=false;

      let rl=new logi.io.ReadLineInterface(converter.options.file);
      for await (let line of rl)
      {
        converter.handleLineFromFile(line);
      }
      converter.ondone && converter.ondone();
    }
    
    handleLineFromFile(line)
    {
      let converter=this;
      let logRecord=null;
      if(!converter.multiLine)
      {
        let startMatch=line.match(converter.recordStartMarker);
        if(startMatch!=null && startMatch.index==0)
        {
          if(converter.dataBuffer!="") logger.error("Unparsed data: ", converter.dataBuffer);
          converter.dataBuffer=line + "\n";
          if(line.endsWith("[[")) converter.multiLine=true;
          else logRecord=converter.processDataBuffer(false);
        }
      }
      else
      {
        converter.dataBuffer += line + "\n";
        if(line.endsWith("]]"))
        {
          converter.multiLine=false;
          logRecord=converter.processDataBuffer(true);
        }
      }

      return logRecord;
    }
    
    processDataBuffer(multiLine)
    {
      let converter=this;
      let logRecord=converter.handleLogRecord(converter.dataBuffer, multiLine);
      converter.dataBuffer="";

      return logRecord;
    }
    
    handleLogRecord(recordLine, multiLine)
    {
      let converter=this;
      let logRecord=converter.logRecordSplitter(recordLine, converter.options, multiLine);
      logRecord.type=converter.options.type;
      logRecord.source=converter.options.name;
      converter.onrecord && converter.onrecord(logRecord);

      return logRecord;
    }
    
    logRecordSplitter(recordLine, options, multiLine)
    {
      let tsformat=options.tsformat || DEFAULTS.tsformat;
      let multiLineMessage="";
      let firstLine=recordLine;
    
      if(multiLine)
      {
        let l=recordLine.split("\n");
        l.pop();
        l.pop();
        l[0]=l[0].substr(0, l[0].length-2);
        firstLine=l.shift();
        multiLineMessage=l.join("\n");
      }
      else firstLine=recordLine.substr(0, recordLine.length-1);
    
      let fields=firstLine.split("] [");
    
      let logRecord={};
      logRecord.ts=fields.shift().substr(1);
      logRecord.server= fields.shift();
      logRecord.level= fields.shift();
    
      fields.shift();
      logRecord.logger= fields.shift();
      
      let lastField=fields.pop();
      let index=lastField.indexOf("]");
      logRecord.message=lastField.substr(index+2) + multiLineMessage;
      fields.push(lastField.substr(0, index));
    
      logRecord=fields.reduce((a,c)=>
      {
        let index=c.indexOf(":");
        if(index!=-1) a[c.substring(0, index)]=c.substring(index+2);
        return a;
      }, logRecord)
    
      logRecord.ts=moment(logRecord.ts, tsformat).toISOString();
      return logRecord;
    }
  }
  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = WLDiagnosticLogConverter;  
  
})(window);

/*[merge-end] <== io/wl-diag-log.converter.js*//*[merge-start] ==> io/log.collection.js*/(function(window)
{
  let __package = "logi.io";
  let __name = "LogCollection";

  class LogCollection extends zn.Base
  {
    constructor(options)
    {
      super();
      this.options=options;
      this.db=new Nedb({filename: options.id});
      this.logDataObjFields=["ts", "source", "type", "message", "ecid", "level"];
      this.pageSize=50;
    }

    init()
    {
      let coll=this;
      coll.fireEvent("show-progress");
      let impl=async(res$, rej$)=>
      {
        await coll.loadDatabase();
        await coll.createIndexes();
        res$();
      }
      
      return new Promise(impl);
    }

    loadDatabase()
    {
      let coll=this;
      coll.fireEvent("show-progress");
      let impl=(res$, rej$)=>
      {
        coll.db.loadDatabase((err) =>
        {
          coll.fireEvent("hide-progress");
          err ? rej$(err) : res$()
        })
      }
      
      return new Promise(impl);
    }

    createIndex(field)
    {
      let coll=this;
      coll.fireEvent("show-progress");
      let impl=(res$, rej$)=>
      {
        coll.db.ensureIndex({fieldName: field}, (err) =>
        {
          coll.fireEvent("hide-progress");
          err ? rej$(err) : res$()
        })
      }
      
      return new Promise(impl);
    }

    removeIndex(field)
    {
      let coll=this;
      coll.fireEvent("show-progress");
      let impl=(res$, rej$)=>
      {
        coll.db.removeIndex({fieldName: field}, (err) =>
        {
          coll.fireEvent("hide-progress");
          err ? rej$(err) : res$()
        })
      }
      
      return new Promise(impl);
    }

    createIndexes()
    {
      let coll=this;
      let impl=async(res$, rej$)=>
      {
        await coll.createIndex("level");
        await coll.createIndex("source");
        await coll.createIndex("type");
        await coll.createIndex("ts");
        await coll.createIndex("text");
        res$();
      }
      return new Promise(impl);
    }

    removeIndexes()
    {
      let coll=this;
      let impl=async(res$, rej$)=>
      {
        await coll.removeIndex("level");
        await coll.removeIndex("source");
        await coll.removeIndex("type");
        await coll.removeIndex("ts");
        await coll.removeIndex("text");
        res$();
      }
      return new Promise(impl);
    }

    key(k)
    {
      return k.replaceAll(/\./g, "-");
    }

    toLogData(l)
    {
      let coll=this;
      let obj={};
      let attrs=[];

      Object.keys(l).forEach((k)=>
      {
        if(!coll.logDataObjFields.includes(k)) attrs.push({name: k, value: l[k]})
      });

      obj.ts=new Date(l.ts);
      obj.source=l.source;
      obj.type=l.type;
      obj.level=l.level;
      obj.ecid=l.ecid;
      obj.message=l.message;
      obj.attrs=attrs;
      obj._id=zn.shortid();
      attrs.forEach((e)=>obj[coll.key(e.name)]=e.value);
      obj.text=obj.message + JSON.stringify(attrs);

      return obj;
    }

    addLogData(o)
    {
      let l = o instanceof Array ? o : [o];
      let coll=this;
      let impl=(res$, rej$)=>
      {
        let items=l.map(o=>coll.toLogData(o));
        coll.db.insert(items, (err, insertedLogData) => err ? rej$(err) : res$(insertedLogData));
      }
      
      return new Promise(impl);
    }

    filter(f)
    {
      let filter={};
      if(!f) return filter;
      
      if(f.level) filter.level=f.level;
      if(f.source) filter.source=f.source;
      if(f.type) filter.type=f.type;
      if(f.ecid) filter.ecid=f.ecid;
      if(f.stDate) filter.ts={$gte: f.stDate};
      if(f.endDate) filter.ts={$lte: f.endDate};
      if(f.term) filter.text=new RegExp(f.term);

      return filter;
    }

    list(options)
    {
      let coll=this;
      options=options||{};
      let pageSize=options.pageSize || coll.pageSize;
      let page=options.page || 1;
      
      let f=coll.filter(options.filter);
      coll.fireEvent("show-progress");
      let impl=(res$, rej$)=>
      {
        coll.db.find(f)
               .sort({ts: -1})
               .skip((page-1) * pageSize).limit(pageSize)
               .exec((err, items) =>
               {
                 coll.fireEvent("hide-progress");
                 err ? rej$(err) : res$(items)
               });
      }
      
      return new Promise(impl);
    }

    removeAll2()
    {
      let coll=this;
      coll.fireEvent("show-progress");
      let impl=(res$, rej$)=>
      {
        coll.db.remove({}, {multi: true}, (err, numRemoved) =>
        {
          coll.fireEvent("hide-progress");
          err ? rej$(err) : res$(numRemoved)
        })
      }
      
      return new Promise(impl);

    }

    remove(ids)
    {
      let coll=this;
      coll.fireEvent("show-progress");
      let impl=(res$, rej$)=>
      {
        coll.db.remove({_id : {$in: ids}}, {multi: true}, (err, numRemoved) =>
        {
          coll.fireEvent("hide-progress");
          err ? rej$(err) : res$(numRemoved)
        })
      }
      
      return new Promise(impl);
    }

    removeAll1()
    {
      let coll=this;
      let impl=async(res$, rej$)=>
      {
        await coll.removeIndexes();
        let list=await coll.list({pageSize: 1000});
        let count=await coll.count({});
        let deleteCount=0;
        while(list.length>0)
        {
          let ids=list.map(x=>x._id);
          await coll.remove(ids);
          deleteCount += list.length;
          console.log(deleteCount +"/"+ count);
          list=await coll.list({pageSize: 1000});
        }
        res$();
      }
      return new Promise(impl);
    }

    removeAll()
    {
      let coll=this;
      let impl=async(res$, rej$)=>
      {
        let req = indexedDB.open("NeDB", 2);
        req.onsuccess = (event)=>
        {
          let db=event.target.result;
          let deleteReq=db.transaction(["nedbdata"], "readwrite").objectStore("nedbdata").delete("logi.db");
          deleteReq.onsuccess=async()=>
          {
            coll.db=new Nedb({filename: coll.options.id});
            await coll.init();
            res$();
          };
          deleteReq.onerror=(err)=>rej$(err);
        }
      }
      return new Promise(impl);
    }

    count(options)
    {
      let coll=this;
      coll.fireEvent("show-progress");
      let impl=(res$, rej$)=>
      {
        coll.db.count(coll.filter(options.filter), (err, count) =>
        {
          coll.fireEvent("hide-progress");
          err ? rej$(err) : res$(count)
        })
      }
      
      return new Promise(impl);

    }

    totalPages(options)
    {
      let coll=this;
      let f=coll.filter(options.filter);

      coll.fireEvent("show-progress");
      let impl=(res$, rej$)=>
      {
        coll.db.count(f, (err, count) =>
        {
          coll.fireEvent("hide-progress");
          if(!err) res$(Math.floor(count / coll.pageSize) + (count % coll.pageSize > 0 ? 1 : 0));
          else rej$(err);
        })
      }
      
      return new Promise(impl);
    }

    distinct(filter, field)
    {
      let coll=this;
      
      let f=coll.filter(filter);

      coll.fireEvent("show-progress");
      let impl=(res$, rej$)=>
      {
        coll.db.find(f)
               .exec((err, items) =>
               {
                 coll.fireEvent("hide-progress");
                 if(!err)
                 {
                   let distinctItemsMap=items.reduce((a,c)=>{a[c[field]]=c[field]; return a}, {});
                   res$(Object.keys(distinctItemsMap));
                 }
                 else rej$(err);
                 
               });
      }
      
      return new Promise(impl);
    }

  }
  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = LogCollection;  
  
})(window);/*[merge-end] <== io/log.collection.js*//*[merge-start] ==> ws/view.js*/(function(window)
{
  let __package = "logi.view";
  let __name = "Workspace";

  class View extends zn.Base
  {
    constructor(options)
    {
      super(options);
      this.dialogActions=
      {
        "OKCANCEL":
        [
          {action: "ok", label: "OK", autohide: false}, 
          {action: "cancel", label: "Cancel"}, 
        ],
        "CANCEL": [{action: "cancel", label: "Cancel"}],
        "OKCANCELCLEAR":
        [
          {action: "ok", label: "OK", autohide: false}, 
          {action: "cancel", label: "Cancel"}, 
          {action: "clear", label: "Clear", slot: "left"}, 
        ]
      };
      this.FILETYPES=
      [
        {label: "Weblogic Log", value: "wl-log"},
        {label: "Weblogic Diagnostic", value: "wl-diag-log"}
      ]
      this.FILETYPESMap=this.FILETYPES.reduce((a,c)=>{a[c.value]=c.label; return a}, {});
      this.fileConvertes=
      {
        "wl-log": logi.io.WLLogConverter,
        "wl-diag-log": logi.io.WLDiagnosticLogConverter
      }

      this.model={};
      this.model.pager={current: 1, list:[]};
      this.model.logFile={};
      this.model.filter={level: "", source: "", type: "", stDate: "", endDate :"", ecid: "", term: ""};
      this.validations={};
    }

    init()
    {
      let view=this;
      view.setupUI();
      view.setupEventHandlers();
      view.loadConfig();
    }
    
    setupUI()
    {
      let view=this;
      view.initCollection();
    }

    setupEventHandlers()
    {
      let view=this;

      $(".file-input").on("change", (evt)=>
      {
        let file=evt.target.files[0];
        if(file==null) return;
        
        view.showFileTypeDialog(file);
      });

      $(".total-pages input").on("keydown", (evt)=>
      {
        if(evt.keyCode==13) view.gotoPage();
      })
    }

    loadConfig()
    {
      let view=this;
      let config=window.localStorage.getItem(`/logi/config`);
      if(!config)
      {
        config=JSON.stringify({
          version: "0.1",
          oid: zn.shortid()
        });
        window.localStorage.setItem(`/logi/config`, config);
      }
      view.config=JSON.parse(config);
    }

    saveConfig()
    {
      let view=this;
      window.localStorage.setItem(`/logi/config`, JSON.stringify(zn.utils.copyObj(view.config)));
    }

    async initCollection()
    {
      let view=this;
      let logCollection=new logi.io.LogCollection({id: "logi.db"});
      logCollection.on("show-progress", () => view.showProgress(true));
      logCollection.on("hide-progress", () => view.showProgress(false));
      
      await logCollection.init();
      view.logCollection=logCollection;

      //await logCollection.removeAll();
      view.model.filter={level: "", source: "", type: "", stDate: "", endDate :"", ecid: "", term: ""};
      view.model.list=await logCollection.list();
      view.apply();

      view.initPager();
      view.indexFilterLOV();
    }

    async indexFilterLOV()
    {
      let view=this;
      let coll=view.logCollection;

      let distinctValues=await coll.distinct(view.model.filter, "level");
      view.levelLov=[{label: "", value: ""}, ...distinctValues.map(x=>{return {label: x, value: x}})];

      distinctValues=await coll.distinct(view.model.filter, "source");
      view.sourceLov=[{label: "", value: ""}, ...distinctValues.map(x=>{return {label: x, value: x}})];

      distinctValues=await coll.distinct(view.model.filter, "type");
      view.typeLov=[{label: "", value: ""}, ...distinctValues.map(x=>{return {label: view.FILETYPESMap[x], value: x}})];

      view.apply();
    }

    async initPager()
    {
      let view=this;
      let logCollection=view.logCollection;
      
      //let count=await logCollection.count();
      let totalPages=await logCollection.totalPages({filter: view.model.filter});
      //console.log(totalPages, count);
      view.model.pager={current:1, max: totalPages, list: []};
      view.updatePager();
      
      $(".total-pages input").val(view.model.pager.current);
      
      view.apply();
    }

    connectToAgent()
    {
      let view=this;
      if(!view.config.proxy) return;

      let client=new logi.agent.Client({endpoint: view.config.proxy, oid: view.config.oid});
      client.connect();
      
      view.client=client;

    }
    
    showProgress(state)
    {
      state ? $(".loader-container").show() : $(".loader-container").hide();
    }

    showAppMenu($evt)
    {
      let view=this;
  
      $evt && $evt.preventDefault();
      $evt && $evt.stopPropagation();
  
      let popup=zn.ui.components.Popup.get("app-menu");
      popup.show();
    }

    onAppMenuAction(action, $event)
    {
      let view=this;
      let popup=zn.ui.components.Popup.get("app-menu");
      popup.hide();

      if(action=='open-file') view.triggerFileOpen();
    }

    onToolbarAction(action, $event)
    {
      let view=this;
      if(action=='open-file') view.triggerFileOpen();
      if(action=='clear') view.clearLogData();
    }

    triggerFileOpen()
    {
      let view=this;
      $(".file-input").val(null).click();
    }
    
    async clearLogData()
    {
      let view=this;
      let logCollection=view.logCollection;

      view.model.filter={level: "", source: "", type: "", stDate: "", endDate :"", ecid: "", term: ""};

      await logCollection.removeAll();
      view.model.list=await logCollection.list();
      view.apply();      

      view.initPager();
    }

    updatePager=()=>
    {
      let view=this;
      let pager=view.model.pager;
  
      pager.list = [];
      let p = pager.current;
      let numPages = pager.max;
      let s = p - 2 < 1 ? 1 : p - 2;
      let e = s + 4;
      if (e > numPages)
      {
        e = numPages;
        s = numPages - 4;
      }
      if (s < 1) s = 1;
      while (s <= e) pager.list.push(s++);
    }
  
    showPage(page, $event)
    {
      $event.preventDefault();

      let view=this;
      let pager=view.model.pager;
  
      if(page=="previous") pager.current = pager.current - 1 < 1 ? 1 : pager.current - 1;
      else if(page=="next") pager.current = pager.current + 1 > pager.max ? pager.max : pager.current + 1;
      else pager.current=parseInt(page);
      view.fetchPage();
    }
  
    async fetchPage()
    {
      let view=this;
      let pager=view.model.pager;
  
      view.updatePager();
      view.model.list=await view.logCollection.list({filter: view.model.filter, page: pager.current});
      view.apply();
      $(".total-pages input").val(pager.current);
      $(".data-table-body").scrollTop(0);
    }
  
    gotoPage()
    {
      let view=this;
      let pager=view.model.pager;
      try
      {
        let page=parseInt($(".total-pages input").val());
        if(page>=1 && page<=pager.max)
        {
          pager.current=parseInt(page);
          view.fetchPage();
        }
      }
      catch(err)
      {
      }
    }
  
    fileSize(size)
    {
      let unit="B"
      if(size > 1024)
      {
        size = Math.round(size/1024 * 100)/100;
        unit = "KB"
      }
      if(size > 1024)
      {
        size = Math.round(size/1024 * 100)/100;
        unit = "MB"
      }
      if(size > 1024)
      {
        size = Math.round(size/1024 * 100)/100;
        unit = "GB"
      }

      return `${size} ${unit}`
    }
    
    showFileTypeDialog(file)
    {
      let view=this;
      view.model.logFile={file: file, type: "", processed: "N", append: "N", name: file.name, size: view.fileSize(file.size)};
      view.validations.fileType="";

      view.apply();
      let dialog=zn.ui.components.Dialog.get("open-file-dialog");
      dialog.show();
    }
    
    isFileTypeFormValid()
    {
      let view=this;
      let logFile=view.model.logFile;
      let valid=true;

      view.validations.fileType="";
      if(logFile.type=="")
      {
        view.validations.fileType="File type is required";
        valid=false;
      }

      view.apply();
      return valid;
    }

    onOpenFileAction($evt)
    {
      let view=this;
      let dialog=$evt.source;
      let logFile=view.model.logFile;

      if($evt.action=="cancel") return;
      if($evt.action=="ok" && !view.isFileTypeFormValid()) return;
      dialog.hide();

      if(logFile.processed=="Y") view.openFileConverted(logFile.file, logFile.append);
      else view.openFileRaw(logFile.file, logFile.type, logFile.append)
    }

    async openFileRaw(file, type, append)
    {
      let view=this;
      let collection=view.logCollection;
      let bufferList=[];
      let checkPointSize=10000;
      let start=new Date().getTime();

      if(append!=="Y") await collection.removeAll();
      view.showProgress(true);

      let converter=new view.fileConvertes[type]({file: file, type: type, name: file.name});
      converter.onprogress=(metric)=>$(".progress").text(`Loading ${file.name} ${metric.percent}%`);
      //converter.onprogress=(metric)=>console.log('Percent: '+metric.percent);
      for await (let rawLogRecord of converter)
      {
        bufferList.push(rawLogRecord);

        if(bufferList.length==checkPointSize)
        {
          console.log("adding to collection ", bufferList.length, "records");
          await collection.addLogData(bufferList);
          bufferList=[];
        }
      }
      if(bufferList.length>0)
      {
        console.log("adding to collection ", bufferList.length, "records");
        await collection.addLogData(bufferList);
        bufferList=[];
      }
      $(".progress").text("");

      let end=new Date().getTime();
      console.log("time: ", (end-start)/1000);

      await view.indexFilterLOV();
      view.model.filter={level: "", source: "", type: "", stDate: "", endDate :"", ecid: "", term: ""};
      view.model.list=await collection.list();
      view.apply();

      view.initPager();
    }


    async openFileConverted(file, append)
    {
      let view=this;
      let collection=view.logCollection;

      let bufferList=[];
      let checkPointSize=10000;
      let start=new Date().getTime();
      
      if(append!=="Y") await collection.removeAll();
      view.showProgress(true);

      let rli=new logi.io.ReadLineInterface(file);
      for await (let line of rli)
      {
        $(".progress").text(`Loading ${file.name} ${rli.metrics().percent}%`);
        //console.log("Percent: ", rli.metrics().percent);
        bufferList.push(JSON.parse(line));
        if(bufferList.length==checkPointSize)
        {
          console.log("adding to collection ", bufferList.length, "records");
          await collection.addLogData(bufferList);
          bufferList=[];
        }
      }
      if(bufferList.length>0)
      {
        console.log("adding to collection ", bufferList.length, "records");
        await collection.addLogData(bufferList);
        bufferList=[];
      }
      $(".progress").text("");

      let end=new Date().getTime();
      console.log("time: ", (end-start)/1000);

      await view.indexFilterLOV();

      view.model.filter={level: "", source: "", type: "", stDate: "", endDate :"", ecid: "", term: ""};
      view.model.list=await collection.list();
      view.apply();

      view.initPager();
    }

    async showFilterDialog($evt)
    {
      $evt.preventDefault();

      let view=this;
      let dialog=zn.ui.components.Dialog.get("filter-dialog");
      dialog.show();
    }

    async onFilterAction($evt)
    {
      let view=this;
      let dialog=$evt.source;
      let coll=view.logCollection;

      if($evt.action=="cancel") return;

      if($evt.action=="clear") view.model.filter={level: "", source: "", type: "", stDate: "", endDate :"", ecid: "", term: ""};
      dialog.hide();

      view.model.list=await coll.list({filter: view.model.filter});
      view.apply();
      view.initPager();
    }

    async filterByECID(ecid, $evt)
    {
      let view=this;
      let coll=view.logCollection;

      $evt.preventDefault();
      view.model.filter.ecid=ecid;
      view.model.list=await coll.list({filter: view.model.filter});
      view.apply();
      view.initPager();
    }

    toggleDescrFormat($evt)
    {
      $evt.preventDefault();
      let $wrapper=$($evt.target).closest(".descr-wrapper");
      if($wrapper.hasClass("formatted")) $wrapper.removeClass("formatted");
      else $wrapper.addClass("formatted");
    }
  }
  
  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = View;

})(window);

/*[merge-end] <== ws/view.js*/