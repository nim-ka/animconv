const error = require("./error.js")

module.exports = function getArgs (argv, table) {
	args = {
		"identifiers": []
	}

	for (let opt in table) {
		for (let i = 0; i < argv.length; i ++) {
			if (argv[i] == table[opt].short) {
				argv[i] = opt
			}
		}
	}

	let lastOption
	
	for (let i = 0; i < argv.length; i ++) {
		let arg = argv[i]
		
		if (arg in table) {
			if (args[arg]) {
				error(`Duplicate argument: ${arg}`)
			}

			lastOption = arg
			
			args[arg] = []

			i ++
			
			for (let j = 0; j < table[arg].len; i ++, j ++) {
				args[arg].push(argv[i])
			}

			i --
		} else {
			args.identifiers.push({
				value: arg,
				lastOption: lastOption
			})
		}
	}
	
	return args
}
