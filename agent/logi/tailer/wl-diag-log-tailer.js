const Tail=require("tail").Tail;
const moment=require("moment");
const logger=require("../../logger");

const DEFAULTS=
{
  start: "(\\[\\d{4,4}-\\d{2,2}-\\d{2,2}T.*\\] )", 
  record: "(\\[\\d{4,4}-\\d{2,2}-\\d{2,2}T.*\\] )(\\[.*\\] )+(((.*)\\[\\[(.|\n)*\\]\\]\n)|(([^\\[]*)\n))",
  tsformat: "YYYY-MM-DDThh:mm:ss.SSSZ"
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
      //logger.debug(`update detected in file ${tailer.options.file}`);
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
  if(!tailer.multiLine)
  {
    let startMatch=line.match(tailer.recordStartMarker);
    if(startMatch!=null && startMatch.index==0)
    {
      if(tailer.dataBuffer!="") logger.error("Unparsed data: ", tailer.dataBuffer);
      tailer.dataBuffer=line + "\n";
      if(line.endsWith("[[")) tailer.multiLine=true;
      else tailer.processDataBuffer(false);
    }
  }
  else
  {
    tailer.dataBuffer += line + "\n";
    if(line.endsWith("]]"))
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

module.exports=Tailer