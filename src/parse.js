const error = require("./error.js")
const fs = require("fs")

function tokenize (data) {
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
	
	return tokens
}

function getCounter (token) {
	return token.slice(1) + "."
}

function parse (tokens) {
	let newTokens = []
	
	if (tokens[0][0] != "." || tokens[tokens.length - 1] != getCounter(tokens[0])) {
		error(`Couldn't parse non-block: ${JSON.stringify(tokens)}`)
	}
	
	let type = tokens[0].slice(1)
	
	for (let i = 1; i < tokens.length - 1; i ++) {
		if (tokens[i][0] == ".") {
			let j = i
			
			while (tokens[i] != tokens[j].slice(1) + ".") {
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

module.exports = function parseAnimFile (filename) {
	let fileData

	try {
		fileData = fs.readFileSync(filename).toString()
	} catch (err) {
		return false
	}

	return parse(tokenize(fileData))
}
