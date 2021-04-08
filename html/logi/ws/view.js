(function(window)
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
        {label: "Weblogic Diagnostic", value: "wl-diag-log"},
        {label: "Weblogic Access Log", value: "wl-access-log"}
      ]
      this.FILETYPESMap=this.FILETYPES.reduce((a,c)=>{a[c.value]=c.label; return a}, {});
      this.fileConvertes=
      {
        "wl-log": logi.io.WLLogConverter,
        "wl-diag-log": logi.io.WLDiagnosticLogConverter,
        "wl-access-log": logi.io.WLAccessLogConverter
      }

      this.model={};
      this.model.pager={current: 1, list:[]};
      this.model.logFile={};
      this.model.filter={level: "", source: "", type: "", stDate: "", endDate :"", ecid: "", term: ""};
      this.model.agent={endpoint: "http://localhost:8181", append: "N"};
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

    showAgentConnectDialog()
    {
      let view=this;
      let dialog=zn.ui.components.Dialog.get("agent-dialog");
      dialog.show();
    }

    async onAgentConnectAction($evt)
    {
      let view=this;
      let dialog=$evt.source;
      let agent=view.model.agent;

      if($evt.action=="cancel") return;
      dialog.hide();
      
      if(agent.append=="N") await view.clearLogData();
      view.connectToAgent();
    }

    connectToAgent()
    {
      let view=this;
      let agent=view.model.agent;

      let client=new logi.agent.Client({endpoint: agent.endpoint, oid: "logi-web-client"});
      client.on("connected", (sources)=>
      {
        view.model.connectedToAgent="Y";
        view.apply();
        zn.ui.Toast("Connected to Agent");
      })
      client.on("log-record", (evt)=>
      {
        view.model.list.unshift(view.logCollection.toLogData(evt.logRecord));
        view.apply();
      })
      client.connect();
      
      view.client=client;

    }

    async disconnectFromAgent()
    {
      let view=this;
      let coll=view.logCollection;

      view.client.disconnect();
      view.model.connectedToAgent="N";
      view.model.list.reverse();

      console.log("adding to collection ", view.model.list.length, "records");

      await coll.addLogData(view.model.list.map(o=>zn.utils.copyObj(o)));
      await view.indexFilterLOV();
      view.model.filter={level: "", source: "", type: "", stDate: "", endDate :"", ecid: "", term: ""};
      view.model.list=await coll.list();
      view.apply();
      view.initPager();
      $(".data-table-body").scrollTop(0);


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

      let url=zn.env[action];
      if(url) window.location=url;

    }

    onToolbarAction(action, $event)
    {
      let view=this;
      if(action=='open-file') view.triggerFileOpen();
      if(action=='clear') view.clearLogData().then();
      if(action=="agent-connect") view.showAgentConnectDialog();
      if(action=="agent-disconnect") view.disconnectFromAgent();
    }

    triggerFileOpen()
    {
      let view=this;
      $(".file-input").val(null).click();
    }
    
    async clearLogData()
    {
      let view=this;
      let impl=async(res$, rej$)=>
      {
        let logCollection=view.logCollection;

        view.model.filter={level: "", source: "", type: "", stDate: "", endDate :"", ecid: "", term: ""};
  
        await logCollection.removeAll();
        view.model.list=[];
        view.apply(); 
        view.initPager();
        $(".data-table-body").scrollTop(0);
        res$();
      }

      return new Promise(impl);
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

    async onOpenFileAction($evt)
    {
      let view=this;
      let dialog=$evt.source;
      let logFile=view.model.logFile;

      if($evt.action=="cancel") return;
      if($evt.action=="ok" && !view.isFileTypeFormValid()) return;
      dialog.hide();

      if(logFile.append=="N") await view.clearLogData();
      if(logFile.processed=="Y") view.openFileConverted(logFile.file, logFile.append);
      else view.openFileRaw(logFile.file, logFile.type, logFile.append)
    }

    async openFileRaw(file, type)
    {
      let view=this;
      let collection=view.logCollection;
      let bufferList=[];
      let checkPointSize=10000;
      let start=new Date().getTime();

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
      $(".data-table-body").scrollTop(0);
    }


    async openFileConverted(file)
    {
      let view=this;
      let collection=view.logCollection;

      let bufferList=[];
      let checkPointSize=10000;
      let start=new Date().getTime();
      
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
      $(".data-table-body").scrollTop(0);
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

      if($evt.action=="clear") view.model.filter={level: "", source: "", type: "", stDate: null, endDate : null, ecid: "", term: ""};
      dialog.hide();

      view.model.list=await coll.list({filter: view.model.filter});
      view.apply();
      view.initPager();
      $(".data-table-body").scrollTop(0);
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

