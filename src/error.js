module.exports = function error (msg) {
	process.stderr.write(`\x1b[1m\x1b[31mError: \x1b[37m${msg}\x1b[0m\n`)
	process.exit(1)
}
