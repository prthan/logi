const moment=require("moment");
const fs=require('fs');
const readline=require('readline');

const DEFAULTS=
{
  start: "####", 
  record: "####(.|\n)*?> \n",
  tsformat: "MMM DD, YYYY hh:mm:ss,SSS AM",
  fieldMap:{"0": "ts", "1": "level", "2": "component", "3": "host", "4":"managed server", "5": "thread name", "6": "user", "8": "ecid", "9": "logId", "10": "context", "11": "code", "12": "message"},
}

let Converter=function(options)
{
  this.options=options;
  this.dataBuffer="";
};

Converter.prototype.process=async function()
{
  let converter=this;
  converter.recordStartMarker=new RegExp(converter.options.recordStartMarker || DEFAULTS.start);
  converter.multiLine=false;
  let fstream=fs.createReadStream(converter.options.file);
  let rl=readline.createInterface({
    input: fstream,
    crlfDelay: Infinity
  });

  for await (let line of rl)
  {
    converter.handleLineFromFile(line);
  }
}

Converter.prototype.handleLineFromFile=function(line)
{
  let converter=this;
  if(!converter.multiLine)
  {
    let startMatch=line.match(converter.recordStartMarker);
    if(startMatch!=null && startMatch.index==0)
    {
      if(converter.dataBuffer!="") console.error("Unparsed data: ", converter.dataBuffer);
      converter.dataBuffer=line + "\n";
      if(!line.endsWith("> ")) converter.multiLine=true;
      else converter.processDataBuffer(false);
    }
  }
  else
  {
    converter.dataBuffer += line + "\n";
    if(line.endsWith("> "))
    {
      converter.multiLine=false;
      converter.processDataBuffer(true);
    }
  }

}

Converter.prototype.processDataBuffer=function(multiLine)
{
  let converter=this;
  converter.handleLogRecord(converter.dataBuffer, multiLine);
  converter.dataBuffer="";
}

Converter.prototype.handleLogRecord=function(recordLine, multiLine)
{
  let converter=this;
  let logRecord=logRecordSplitter(recordLine, converter.options, multiLine);
  logRecord.type=converter.options.type;
  logRecord.source=converter.options.name;
  console.log(JSON.stringify(logRecord));
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

module.exports=Converter