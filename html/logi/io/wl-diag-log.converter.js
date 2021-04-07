(function(window)
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

