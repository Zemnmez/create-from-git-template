# What's this?
This is a template for creating reusable components in the form of npm packages, based on the venerable `create-react-library`.

I've been having fun making and maintaining several small libraries, and this package unifies the creation and update of them.

## What does it do?

It creates a new package based on your configuration input that is dervied from the template. Differently to some templates, the template component is its own git repo, with its own history. This means that any package using it can sync with updates to the template by doing a `git merge`, no matter how far down the line it is and git should do its best to resolve the changes.

It generates jsdoc conformant documentation which editors and documentation generation systems can pick up on derived from the package.json. It then uses `typedoc` and `typedoc-plugin-markdown` to generate documentation of your library. Generation of documentation from code keeps duplication down.
