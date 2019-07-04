const ora = require('ora')
const chalk = require('chalk')
const commander = require('commander')
const readline = require('readline')
const { promisify } = require('util')
const { join } = require('path')
const readFile = promisify(require('fs').readFile);
const writeFile = promisify(require('fs').writeFile);
const exec = promisify(require('child_process').exec);
const { execFile } = require('child_process');
const ncp = promisify(require('ncp').ncp)

const templateDir = 'create-react-app-z-template';
const myName = 'create-react-app-z'


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

const loadify = (promise, caption, {
  significant = true
}) => async (...args) => {
  const spinner = ora(caption).start()
  try {
    const ret = await promise(...args);
    if (significant) {
      spinner.succeed()
    } else spinner.stop()
    return ret
  } catch (e) {
    spinner.fail()
    throw (e)
  }
}

class wd extends String {
  constructor(...args) { super(...args); }

  cd(dir) { return new wd(join(this.toString(), dir)) }

  async cp(target) {
    const source = this.toString();
    await loadify(ncp, `cp ${source} ${target}`)(source, target)
    return new wd(target)
  }

  async read(file, ...etc) {
    file = join(this.toString(), file)
    return await loadify(readFile, `read ${file}`)(file, ...etc)
  }

  async write(file, ...etc) {
    file = join(this.toString(), file)
    return await loadify(writeFile, `write ${file}`)(file, ...etc)
  }

  async run(program, ...args) {
    return new Promise((ok, fail) => {
      const cli_text = [program, ...args].join(" ");
      const spinner = ora(cli_text).start();

      const process = execFile(program, args, { cwd: this.toString() },
        (err, stdout, stderr) => {
          if (err) {
            spinner.fail(cli_text);
            fail(err);
          }
          spinner.succeed(cli_text);
          ok(stdout.trim());
        })

      process.stdout.on('data', d => spinner.text = `[${program} ${this.toString()}] ${d}`);
    })
  }

  async _run(program, ...args)  {
    const { err, stdout, stderr } = await spawn(program, args,  {
      cwd: this.toString()
    })

    if (err) throw new Error(`${[program, ...args].join(" ")} failed with ${err}\n\tstdout: ${stdout}\n\tstderr: ${stderr}`);
    return stdout.trim();
  }

}

const spaceArray = (s) => s.split(/s+/).map(v => v.trim())

const root = new wd(".")
const doOptions = async () => {
  const gitUsername = await root.run("git", "config", "user.name")

  let options = commander
    .option('--name <name>', 'package name')
    .option('--ver <version>', 'package version', '0.1.0')
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


  const tmpDirName = "tmp-template"
  await root.run("git", "clone", templateDir, tmpDirName)
  const tmplDir = root.cd(tmpDirName)

  const pkg = JSON.parse(await tmplDir.read("package.json"))

  const newPkg = { ...pkg, name, version, description, repository, author };

  await tmplDir.write('package.json', JSON.stringify(newPkg, null, 2))
  await tmplDir.run("git", "add", "package.json")
  await tmplDir.run("git", "commit", "-m", `[${myName}]: update package.json`)

  if (deps) await tmplDir.run("yarn", "add", ...deps);
  if (peers) await tmplDir.run("yarn", "add", "--peer", "--dev", ...peers);
  if (devDeps) await tmplDir.run("yarn", "add", "--dev", ...devDeps);


  await tmplDir.run("yarn")

  await tmplDir.run("git", "add", "yarn.lock")
  await tmplDir.run("git", "commit", "-m", `[${myName}]: add yarn.lock`)

}


const always = () => rl.close();

async function main() {
  await Do();

}

main().catch(e => {
  always();
  console.log(e)
}).then(() => always());
