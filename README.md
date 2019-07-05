
# What's this?
This is a `yarn create` program for creating npm packages derived from others.

```
Usage: create-z-app [options] <source-repo> <target>

Options:
  --name <name>                package name
  --ver [version]              package version (default: "0.1.0")
  --description [description]  package description
  --repository <repo uri>      package repository URI
  --author <name>              package author name
  --peers [packages]           added peer dependencies
  --devDeps [packages]         added dev dependencies
  --deps [packages]            added bundle dependencies
  -h, --help                   output usage information
```

## What does it do?

It creates a new package based on your configuration input that is dervied from the template. Differently to some templates, the template component is its own git repo, with its own history. This means that any package using it can sync with updates to the template by doing a `git merge`, no matter how far down the line it is and git should do its best to resolve the changes.

