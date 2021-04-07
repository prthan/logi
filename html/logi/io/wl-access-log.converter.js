(function(window)
{
  let __package = "logi.io";
  let __name = "WLAccessLogConverter";

  const DEFAULTS=
  {
    tsformat: "MM-DD-YYYY hh:mm:ss"    
  }
  
  class WLAccessLogConverter
  {
    constructor(options)
    {
      this.options=options;
      this.dataBuffer="";
      this.fields=[];
    }
    
    async *[Symbol.asyncIterator]()
    {
      let converter=this;

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
      if(line.indexOf("#Fields:")==0)
      {
        converter.fields=line.substring(9).split(" ");
        return;
      }
      if(line.indexOf("#")==0) return;
    
      return converter.handleLogRecord(line);
    }
    
    handleLogRecord(recordLine, multiLine)
    {
      let converter=this;
      let logRecord=converter.logRecordSplitter(recordLine, converter.options, converter.fields);
      logRecord.type=converter.options.type;
      logRecord.source=converter.options.name;
      converter.onrecord && converter.onrecord(logRecord);

      return logRecord;
    }
    
    logRecordSplitter(recordLine, options, fields)
    {
      let tsformat=options.tsformat || DEFAULTS.tsformat;
      let parts=recordLine.split("\t");
      let lr=parts.reduce((a,c,i)=>
      {
        a[fields[i]]=c;
        return a;
      }, {})
    
      let logRecord={}
      logRecord.ts=moment(lr.date + " "+ lr.time, tsformat).toISOString();
      logRecord.message = `${lr["cs-method"]} ${lr["cs-uri"]}`;
      let status=parseInt(lr["sc-status"]);
      if(status>=400) logRecord.level="ERROR";
      else logRecord.level="INFO";
      logRecord["status-code"]=lr["sc-status"];

      return logRecord;
    }
  }
  __package.split(".").reduce((a, e) => a[e] = a[e] || {}, window)[__name] = WLAccessLogConverter;  
  
})(window);

