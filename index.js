const ora = require('ora')
const chalk = require('chalk')
const commander = require('commander')
const readline = require('readline')
const { promisify } = require('util')
const exec = promisify(require('child_process').exec);


const noCompleter = () => [];
let completer = noCompleter;
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer
})

const defCompleter = (Default) => (line) => line.length === 0?
  [Default]: [];

const ask = (q) => new Promise((ok, err) =>
  rl.question(q, resp => {
    if(resp instanceof(Error)) return err(resp);
    ok(resp);
  })
)

const sentencify = ([firstChr, ...etc]) => `${firstChr.toUpperCase()}${etc.join("")}`


const debug = process.env.DEVELOPMENT

const shell = async (commandLine) => {
  const { err, stdout, stderr } = await exec(commandLine);
  if (debug) {
    console.log(commandLine, stdout, stderr)
  }
  if (err) throw err;
  return stdout.trim();
}

const spaceArray = (s) => s.split(/s+/).map(v => v.trim())

const doOptions = async () => {
  const gitUsername = await shell("git config user.name")

  let options = commander
    .option('--name <name>', 'package name')
    .option('--version <version>', 'package version', '0.1.0')
    .option('--description <description>', 'package description')
    .option('--repository <repo uri>', 'package repository URI')
    .option('--author <name>', 'package author name', gitUsername)
    .option('--deps [packages]', 'extra space separated dependencies to add', spaceArray)
    .option('--peers [packages]', 'extra peer dependencies to add', spaceArray)
    .option('--devDeps [packages]', 'extra dev dependencies to add', spaceArray)
    //.option('--conf <file>', 'load defaults from file', loadConfFromFile)
    .parse(process.argv)

  var newArgs = [...process.argv]
  for (let { long, description, defaultValue, optional } of options.options) {
    if (optional) continue;

    const parsedName = long.slice(2);
    if (parsedName in options) {
      const v = options[parsedName];
      if (!(v instanceof Function)) if (v !== defaultValue) continue;
    }

    completer = defCompleter(defaultValue)
    const newValue = await ask(chalk.blue(`${description}${
      defaultValue?chalk.white(` [${defaultValue}]`):""
    }: `))
    completer = noCompleter

    newArgs = newArgs.concat([long, newValue])

    // allows errors to be thrown immediately
    options = options.parse(newArgs)
  }

  return options
}

async function Do() {
  const options = await doOptions();
}

const always = () => rl.close();

async function main() {
  await Do();
  always();
}

main();
