const Tail=require("tail").Tail;
const moment=require("moment");
const logger=require("../../logger");

const DEFAULTS=
{
  start: "####", 
  record: "####(.|\n)*?> \n",
  tsformat: "MMM DD, YYYY hh:mm:ss,SSS AM",
  fieldMap:{"0": "ts", "1": "level", "2": "component", "3": "host", "4":"managed server", "5": "thread name", "6": "user", "8": "ecid", "9": "logId", "10": "context", "11": "code", "12": "message"},
}

let Tailer=function(options, publishLogRecord)
{
  this.options=options;
  this.dataBuffer="";
  this.publishLogRecord=publishLogRecord;
};

Tailer.prototype.start=function()
{
  let tailer=this;
  //tailer.recordPattern=new RegExp(tailer.options.recordMarker || DEFAULTS.record, "gm");
  tailer.recordStartMarker=new RegExp(tailer.options.recordStartMarker || DEFAULTS.start);
  tailer.multiLine=false;

  try
  {
    tailer.tail=new Tail(tailer.options.file);
    tailer.tail.on("line", (line)=>
    {
      logger.debug(`update detected in file ${tailer.options.file}`);
      tailer.handleLineFromFile(line);
    });
    tailer.tail.on("error", (err)=>
    {
      logger.error(`error occured while monitoring the log file ${tailer.options.file}`, err);
    });
      
    logger.info(`monitoring ${tailer.options.file}`);
  }
  catch(err)
  {
    logger.error(`error occured while monitoring the log file ${tailer.options.file}`, err);
  }
}

Tailer.prototype.stop=function()
{
  let tailer=this;
  tailer.tail.unwatch();
}

Tailer.prototype.handleLineFromFile=function(line)
{
  let tailer=this;
  if(!tailer.multiLine)
  {
    let startMatch=line.match(tailer.recordStartMarker);
    if(startMatch!=null && startMatch.index==0)
    {
      if(tailer.dataBuffer!="") logger.error("Unparsed data: ", tailer.dataBuffer);
      tailer.dataBuffer=line + "\n";
      if(!line.endsWith("> ")) tailer.multiLine=true;
      else tailer.processDataBuffer(false);
    }
  }
  else
  {
    tailer.dataBuffer += line + "\n";
    if(line.endsWith("> "))
    {
      tailer.multiLine=false;
      tailer.processDataBuffer(true);
    }
  }

}

Tailer.prototype.processDataBuffer=function(multiLine)
{
  let tailer=this;
  tailer.handleLogRecord(tailer.dataBuffer, multiLine);
  tailer.dataBuffer="";
}

Tailer.prototype.handleLogRecord=function(recordLine, multiLine)
{
  let tailer=this;
  let logRecord=logRecordSplitter(recordLine, tailer.options, multiLine);
  logRecord.type=tailer.options.type;
  logRecord.source=tailer.options.name;
  tailer.publishLogRecord(logRecord);
}

let logRecordSplitter=(recordLine, options, multiLine)=>
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

module.exports=Tailer