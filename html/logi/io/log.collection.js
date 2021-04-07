(function(window)
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
      this.rid=0;
    }

    init()
    {
      let coll=this;
      coll.fireEvent("show-progress");
      let impl=async(res$, rej$)=>
      {
        await coll.loadDatabase();
        await coll.createIndexes();
        coll.rid=await coll.computeRid();
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

    computeRid()
    {
      let coll=this;
      coll.fireEvent("show-progress");
      let impl=(res$, rej$)=>
      {
        coll.db.count({}, (err, count) =>
        {
          coll.fireEvent("hide-progress");
          err ? rej$(err) : res$(count)
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
        await coll.createIndex("rid");
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
        await coll.removeIndex("rid");
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
      obj.level=l.level.toUpperCase();
      obj.ecid=l.ecid;
      obj.message=l.message;
      obj.attrs=attrs;
      obj._id=zn.shortid();
      obj.rid=++coll.rid;
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
      if(f.ecid) filter.ecid=new RegExp(f.ecid);
      if(f.term) filter.text=new RegExp(f.term);

      let ts=[];
      if(f.stDate) ts.push({ts: {$gte: f.stDate}});
      if(f.endDate) ts.push({ts: {$lte: moment(moment(f.endDate).format("YYYY-MM-DD")+" 23:59:59")._d}});
      if(ts.length>0) filter.$and=ts;

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
               .sort({ts: -1, rid: -1})
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
      options=options||{};
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
  
})(window);