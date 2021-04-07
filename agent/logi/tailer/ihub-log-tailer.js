const Tail=require("tail").Tail;
const logger=require("../../logger");

let Tailer=function(options, publishLogRecord)
{
  this.options=options;
  this.dataBuffer="";
  this.publishLogRecord=publishLogRecord;
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
  tailer.publishLogRecord(JSON.parse(line));
}

module.exports=Tailer