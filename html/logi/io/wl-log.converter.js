(function(window)
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

