const error = require("./error.js")
const util = require("./util.js")

const fs = require("fs")

function tokenize (data, log) {
	log("Lexing file...")

	let tokens = []
	let token = ""
	
	for (let i = 0; i < data.length; i ++) {
		if (data[i] == "#" || data[i] == ";" || (data[i] == "/" && data[i + 1] == "/")) {
			if (token.length) {
				tokens.push(token)
			}
			
			token = ""
			
			while (data[i] != "\n") {
				i ++
			}
			
			i ++
		}
		
		if (data[i] == "/" && data[i + 1] == "*") {
			if (token.length) {
				tokens.push(token)
			}
			
			token = ""
			
			while (data[i] != "*" || data[i + 1] != "/") {
				i ++
			}
			
			i += 2
		}
		
		if (/\s/.test(data[i])) {
			if (token.length) {
				tokens.push(token)
			}
			
			token = ""
		} else {
			token += data[i]
		}
	}
	
	if (token.length) {
		tokens.push(token)
	}

	log("Done!")
	
	return tokens
}

function parse (tokens) {
	let newTokens = []
	
	if (tokens[0][0] != "." || tokens[tokens.length - 1] != util.getCounter(tokens[0])) {
		error(`Couldn't parse non-block: ${JSON.stringify(tokens)}`)
	}
	
	let type = tokens[0].slice(1)
	
	for (let i = 1; i < tokens.length - 1; i ++) {
		if (tokens[i][0] == ".") {
			let j = i
			
			while (tokens[i] != util.getCounter(tokens[j])) {
				i ++
			}
			
			newTokens.push(parse(tokens.slice(j, i + 1)))
		} else {
			newTokens.push({
				"type": "data",
				"value": tokens[i]
			})
		}
	}
	
	return {
		"type": type,
		"children": newTokens
	}
}

function parseWrapper (tokens, log) {
	log("Creating AST...")

	let ast = parse(tokens)

	log("Done!")

	return ast
}

module.exports = function parseAnimFile (filename, log) {
	log("Reading file...")

	let fileData

	try {
		fileData = fs.readFileSync(filename).toString()
	} catch (err) {
		return false
	}

	log("Done!")

	return parseWrapper(tokenize(fileData, log), log)
}
