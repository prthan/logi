const yargs=require("yargs");

const WLLogConverter=require("./wl-log-converter");
const WLDiagLogConverter=require("./wl-diag-log-converter");

const FILE_TYPE_CONVERTER=
{
  "wl-log": WLLogConverter,
  "wl-diag-log": WLDiagLogConverter,
}

let cli={};

cli.convert=(filename, type, name)=>
{
  new FILE_TYPE_CONVERTER[type]({type: type, name: name, file: filename}).process();
}

cli.help=()=>
{
  console.log(`
Usage: logi-cli convert [options]
Options:
  -f, --file         input file to convert
  -t, --type         type of file, wl-log | wl-diag-log
  -n, --name         name for the file
  -o, --output       output file to put converted log data
  -h, --help         show this help
`)
}

cli.run = ()=>
{
  let args=yargs(process.argv.slice(2))
          .help(false)
          .version(false)
          .argv;

  if(args.help)
  {
    cli.help();
    return;
  }

  var target=cli[args._[0]];
  if(target==null)
  {
    console.log("invalid command");
    return;
  }

  let file=args.file || args.f;
  let type=args.type || args.t;
  let name=args.name || args.n;

  if(!file || !type || !name)
  {
    console.log("insufficient options")
    cli.help();
    return;
  }

  target.apply(cli, [file, type, name]);
}

cli.run();
