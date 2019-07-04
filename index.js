const ora = require('ora')
const chalk = require('chalk')
const commander = require('commander')
const readline = require('readline')
const { promisify } = require('util')
const { join } = require('path')
const readFile = promisify(require('fs').readFile);
const writeFile = promisify(require('fs').writeFile);
const exec = promisify(require('child_process').exec);
const execFile = promisify(require('child_process').exec);

const templateDir = 'create-react-app-z-template';


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

const loadify = (promise, caption) => async (...args) => {
  const spinner = ora(caption)
  try {
    const ret = await promise(...args);
    spinner.succeed()
    return ret
  } catch (e) {
    fail()

    throw (e)
  }
}

const shell = async (commandLine) => {
  const { err, stdout, stderr } = await exec(commandLine);
  if (debug) {
    console.log(commandLine, stdout, stderr)
  }
  if (err) throw err;
  return stdout.trim();
}

const run = async(program, argv, options) => {
  const { err, stdout, stderr } = await execFile(program, argv, options);
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
  const { name, version, description, repository,
    author, deps, peers, devDeps } = await doOptions();

  const x = async (cmd) => loadify(shell, cmd)(cmd);
  const xf = async (...args) => loadify(run, args.join(" "))(...args);
  const read = async (file, ...args) => await loadify(readFile, `read ${file}`)
    (name, ...args)

  const write = async (file, ...args) => await loadify(writeFile, `write ${file}`)
    (file, ...args)

  const pkg = JSON.parse(await read(join(templateDir, 'package.json')))
  const newPkg = { ...pkg, name, version, description, repository, author };
  await write(
    join(templateDir, 'package.json'),
    JSON.stringify(newPkg, null, 2)
  )

  if(deps) await xf("yarn", ["add", ...deps], { cwd: templateDir });
  if(peers) await xf("yarn", ["add", "--peer", "--dev", ...peers], { cwd: templateDir });
  if(devDeps) await xf("yarn", ["add", "--dev", ...devDeps], { cwd: templateDir });

  await xf("yarn", [], {cwd: templateDir})


}

const always = () => rl.close();

async function main() {
  await Do();
  always();
}

main();
