#!/usr/bin/env node

const ora = require('ora')
const chalk = require('chalk')
const commander = require('commander')
const readline = require('readline')
const { promisify } = require('util')
const path = require('path')
const readFile = promisify(require('fs').readFile);
const writeFile = promisify(require('fs').writeFile);
const exec = promisify(require('child_process').exec);
const { execFile } = require('child_process');
const tmp = require('tmp');
const tmpdir = promisify(tmp.dir);
const templateDir = 'create-react-app-z-template';
const package = require('./package.json')


const cannotBeEmpty = (name) => (v) => {
  if (!v) throw new Error(`${name} cannot be empty`);
  return v;
}


const spaceArray = (s) => s.split(/s+/).map(v => v.trim()).filter(v => v!=='')

let options = commander
  .command(`${package.name} <source-repo> <target>`, { isDefault: true })
  .version(package.version)
  .option('--name <name>', 'package name', cannotBeEmpty("name"))
  .option('--ver [version]', 'package version', '0.1.0')
  .option('--description [description]', 'package description')
  .option('--repository <repo uri>', 'package repository URI', cannotBeEmpty('repository'))
  .option('--author <name>', 'package author name', cannotBeEmpty('author'))
  .option('--peers [packages]', 'added peer dependencies', spaceArray)
  .option('--devDeps [packages]', 'added dev dependencies', spaceArray)
  .option('--deps [packages]', 'added bundle dependencies', spaceArray)
  //.option('--conf <file>', 'load defaults from file', loadConfFromFile)


const joinpath = (...segments) => {
  const myPath = path.join(...segments);
  const relative = path.relative(process.cwd(), myPath);
  const absolute = path.resolve(myPath);
  if (relative.length < absolute.length) return relative;
  return absolute;
}

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
} = {}) => async (...args) => {
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

  cd(dir) { return new wd(path.join(this.toString(), dir)) }

  async read(file, ...etc) {
    file = joinpath(this.toString(), file)
    return await loadify(readFile, `read ${file}`)(file, ...etc)
  }

  async write(file, ...etc) {
    file = joinpath(this.toString(), file)
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

      process.stdout.on('data', d => spinner.text = `[${program}] ${d}`);
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


const oraFail = (err) => {
  ora(err).fail();
  throw new Error(err);
}

const root = new wd(".")
const doOptions = async () => {


  options
    .parse(process.argv)

  const [sourceRepo, target] = options.args


  if (!sourceRepo) oraFail("sourceRepo must be specified!")
  if (!target) oraFail("target must be specified!")


  var newArgs = [...process.argv]
  for (let { long, description, defaultValue, optional } of options.options) {
    //if (optional) continue;

    const parsedName = long.slice(2);
    if (parsedName in options) {
      const v = options[parsedName];
      if (!(v instanceof Function)) if (v !== defaultValue) continue;
    }

    completer = defCompleter(defaultValue)
    const newValue = await ask(`${optional?"":chalk.red("*")}${chalk.cyan(`${description}${
      defaultValue?chalk.white(` [${defaultValue}]`):""
    }: `)}`)
    completer = noCompleter

    newArgs = newArgs.concat([long, newValue])

    // allows errors to be thrown immediately
    try {
      options = options.parse(newArgs)
    } catch (e) {
      ora(e).fail()
      throw(e)
    }
  }

  return { ...options, sourceRepo, target }
}

const templateUri = "git@github.com:Zemnmez/create-react-app-z-template.git"


async function Do() {
  const { name, version, description, repository,
    author, deps, peers, devDeps, target, sourceRepo } = await doOptions();

  const tmpDirName = target
  await root.run("git", "clone", sourceRepo, target)
  const tmplDir = root.cd(tmpDirName)

  const pkg = JSON.parse(await tmplDir.read("package.json"))

  pkg.scripts["update-template"] = "git fetch template && git merge template"

  const newPkg = { ...pkg, name, version, description, repository, author };

  await tmplDir.write('package.json', JSON.stringify(newPkg, null, 2))
  await tmplDir.run("git", "add", "package.json")
  await tmplDir.run("git", "commit", "-m", `[${package.name}]: update package.json`)


  if (deps.length) await tmplDir.run("yarn", "add", ...deps);
  if (peers.length) await tmplDir.run("yarn", "add", "--peer", "--dev", ...peers);
  if (devDeps.length) await tmplDir.run("yarn", "add", "--dev", ...devDeps);


  await tmplDir.run("yarn")

  await tmplDir.run("git", "add", "yarn.lock")
  await tmplDir.run("git", "commit", "-m", `[${package.name}]: add/update yarn.lock`)

  await tmplDir.run("git", "remote", "rename", "origin", "template")
  if (repository) await tmplDir.run("git", "remote", "add", "origin", repository)

  ora("").succeed("tasty")

}


const always = () => rl.close();

async function main() {
  await Do();

}

main().catch(e => {
  always();
  console.log(e)
}).then(() => always());
