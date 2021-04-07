const Tail=require("tail").Tail;
const moment=require("moment");
const logger=require("../../logger");

const DEFAULTS=
{
  tsformat: "MM-DD-YYYY hh:mm:ss"
}

let Tailer=function(options, publishLogRecord)
{
  this.options=options;
  this.dataBuffer="";
  this.publishLogRecord=publishLogRecord;
  this.fields=[];
};

Tailer.prototype.start=function()
{
  let tailer=this;
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
      logger.error(`error occured while monitoring the log file ${tailer.options.file}`, err.message);
      tailer.tail=null;
    });
      
    logger.info(`monitoring ${tailer.options.file}`);
  }
  catch(err)
  {
    logger.error(`error occured while monitoring the log file ${tailer.options.file}`, err.message);
    tailer.tail=null;
  }
}

Tailer.prototype.stop=function()
{
  let tailer=this;
  if(tailer.tail) tailer.tail.unwatch();
}

Tailer.prototype.handleLineFromFile=function(line)
{
  let tailer=this;
  if(line.indexOf("#Fields:")==0)
  {
    tailer.fields=line.substring(9).split(" ");
    return;
  }
  if(line.indexOf("#")==0) return;
  
  tailer.handleLogRecord(line);
}

Tailer.prototype.handleLogRecord=function(recordLine)
{
  let tailer=this;
  let logRecord=logRecordSplitter(recordLine, tailer.options, tailer.fields);
  logRecord.type=tailer.options.type;
  logRecord.source=tailer.options.name;
  tailer.publishLogRecord(logRecord);
}

let logRecordSplitter=(recordLine, options, fields)=>
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

module.exports=Tailer