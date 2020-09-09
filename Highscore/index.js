'use strict'
function a(){
	let _tournamentSettings;
	let tableSummary;
	let settingsIframe = document.getElementById('settings');
	let arenaProperties;
	let arenaList = document.getElementById('arena-datalist');
	let participantList = document.getElementById('participants-selectable');
	let participantsSelected = document.getElementById('participants-selected');
	let tableContainer = document.getElementById('highscore-table-container');
	let btnStart = document.getElementById('btnStart');
	let _brackets;
	let bracketsOngoing = 0;
	let bracketsOngoingLimit = 4;
	let aborted = [];
	btnStart.onclick = start;
	for(const button of document.getElementsByClassName('transfer-button')){
		button.onclick = transferTo;
	}
	document.getElementById('arena').onchange = event => {
		let option = getOption(arenaList, event);
		if(option !== undefined){
			for(const element of document.getElementsByClassName('participant-team-container')){
				element.parentNode.removeChild(element);
			}
			document.title = event.target.value + ' Highscore';
			settingsIframe.contentWindow.postMessage({type: 'SetArena', value: event.target.value});
			getParticipants(option.value);
		}
	};
	fetch('https://api.github.com/orgs/AI-Tournaments/repos').then(response => response.json()).then(repos => {
		repos.forEach(repo => {
			if(repo.full_name.endsWith('-Arena')){
				fetch('https://raw.githubusercontent.com/GAME-Arena/master/properties.json'.replace('GAME-Arena', repo.full_name)).then(response => response.json()).then(_arenaProperties => {
					arenaProperties = _arenaProperties;
					if(arenaProperties.header.limits.participants.max === 1 || arenaProperties.header.limits.participantsPerTeam.max === 1){
						let option = document.createElement('option');
						option.value = repo.full_name.replace(/.*\/|-Arena/g, '');
						option.dataset.full_name = repo.full_name;
						arenaList.appendChild(option);
					}
				});
			}
		});
	});
	window.onmessage = messageEvent => {
		if(messageEvent.data.type === 'log'){
			document.getElementById(messageEvent.data.value.id).dataset.log = JSON.stringify(messageEvent.data.value.log);
			let iframe = document.getElementById('iframe_' + messageEvent.data.value.id);
			iframe.parentNode.removeChild(iframe);
			updateTable();
			bracketsOngoing--;
			if(bracketsOngoing === 0 && _brackets.length === 0){
				tableSummary.classList.remove('working');
			}else if(bracketsOngoing < bracketsOngoingLimit){
				startNextBracket();
			}
		}else if(settingsIframe.contentWindow === messageEvent.source){
			switch(messageEvent.data.type){
				case 'properties':
					arenaProperties = messageEvent.data.value.properties;
					settingsIframe.style.height = messageEvent.data.value.height + 'px';
					break;
				case 'settings':
					_tournamentSettings = messageEvent.data.value;
					startNextBracket();
					break;
			}
		}else{
			console.error('Source element not defined!');
			console.error(messageEvent.source.frameElement);
		}
	}
	function updateTable(){
		let logs = [];
		for(const arenaLog of document.getElementsByClassName('score-cell')){
			if(arenaLog.dataset.log !== undefined){
				logs.push(JSON.parse(arenaLog.dataset.log));
			}
		}
		logs.forEach(arenaLog => {
			arenaLog.data.forEach(log => {
				let _log = log.filter(l=>l.type==='Done');
				if(0 < _log.length){
					log = _log[0].value;
					let ai_1 = log.score[0];
					let ai_2 = log.score[1];
					let cell = document.getElementById(ai_1.name + '_' + ai_2.name);
					if(!cell.classList.contains('disqualified')){
						cell.innerHTML = round(ai_1.score, 1) + ' - ' + round(ai_2.score, 1);
						if(ai_1.score < ai_2.score){
							cell.classList.add('ai-2');
						}else if(ai_2.score < ai_1.score){
							cell.classList.add('ai-1');
						}
						cell.dataset.score = JSON.stringify([{'name': ai_1.name, 'score': ai_1.score}, {'name': ai_2.name, 'score': ai_2.score}]);
						updateSummaryTable();
					}
				}else{
					let _log = log.filter(l=>l.type==='Aborted');
					if(0 < _log.length){
						log = _log[0].value;
						aborted.push(log.name);
						let summaryHeader = document.getElementById(log.name + '_summaryHeader');
						if(summaryHeader !== null){
							summaryHeader.parentNode.parentNode.removeChild(summaryHeader.parentNode);
						}
						for(const element of document.getElementsByClassName(log.name)){
							if(element.id !== log.name+'_'+log.name){
								element.classList.add('disqualified');
							}
						}
					}
				}
			});
		});
	}
	function getOption(element, event){
		for(const option of element.getElementsByTagName('option')){
			if(option.value === event.target.value){
				return option;
			}
		}
	}
	function sortOptions(selectElement){
		let options = [...selectElement.options];
		options.sort(function(a, b){
			if(a.value < b.value){return -1;}
			if(b.value < a.value){return 1;}
			return 0;
		});
		for(let option of options){
			selectElement.add(option);
		}
	}
	function transferTo(event){
		if(event !== undefined){
			let selectElement_moveTo = document.getElementById(event.target.dataset.select);
			let selectElements = document.getElementsByClassName('participants');
			for(const selectElement of selectElements){
				for(let option of [...selectElement.selectedOptions]){
					selectElement_moveTo.add(option);
					option.selected = false;
				}
			}
			btnStart.disabled = participantsSelected.options.length < 2;
			sortOptions(selectElement_moveTo);
		}
		let participants = [];
		for(const option of participantsSelected.options){
			participants.push(option.dataset.name);
		}
		buildTable(participants);
	}
	function getParticipants(arena=''){
		for(const selectElement of document.getElementsByClassName('participants')){
			while(0 < selectElement.length){
				selectElement.remove(0);
			}
		}
		let promises = [];
		fetch('https://api.github.com/search/repositories?q=topic:AI-Tournament-Participant+topic:'+arena,{
			headers: {Accept: 'application/vnd.github.mercy-preview+json'} // TEMP: Remove when out of preview. https://docs.github.com/en/rest/reference/search#search-topics-preview-notices
		}).then(response => response.json()).then(response => {
			response.items.forEach(repo => {
				promises.push(fetch('https://api.github.com/repos/' + repo.full_name + '/git/trees/' + repo.default_branch)
				.then(response => response.json())
				.then(data => {
					data.tree.forEach(file =>{
						if(file.type === 'blob' && file.path === 'participant.js'){
							let option = document.createElement('option');
							option.dataset.name = repo.full_name.replace('AI-Tournament-Participant-'+arena+'-','');
							option.dataset.url = 'https://raw.githubusercontent.com/' + repo.full_name + '/' + repo.default_branch + '/' + file.path;
							option.innerHTML = option.dataset.name;
							participantList.appendChild(option);
						}
					});
				})
				.catch(error => {
					console.error(error);
				}));
			});
			Promise.all(promises).then(() => {
				sortOptions(participantList);
			})
		});
	}
	function start(){
		btnStart.disabled = true; // TODO: Remove when rerun should be possible without reload.
		tableSummary.classList.add('working');
		['resultAI1', 'resultAI2', 'resultAverage'].forEach(className => {
			for(const summaryCell of document.getElementsByClassName(className)){
				summaryCell.dataset.score = 0;
			}
		});
		let participants = [];
		for(const option of participantsSelected.options){
			participants.push({
				name: option.dataset.name,
				url: option.dataset.url
			});
		}
		_brackets = buildBrackets(participants, arenaProperties.header);
		bracketsOngoing = 0;
		settingsIframe.contentWindow.postMessage({type: 'GetSettings'});
	}
	function buildBrackets(participants=[], arenaHeader={}){ // TODO: Add support for dynamic team amount.
		let brackets = [];
		let _participants = participants.slice();
		_participants.forEach(a => {
			_participants.forEach(b => {
				if(a !== b){
					let dontAdd = false;
					if(arenaHeader.symmetric){
						brackets.forEach(bracket => {
							dontAdd |= bracket[0].includes(a) && bracket[0].includes(b);
						});
					}
					if(!dontAdd){
						brackets.push([[a], [b]]);
					}
				}
			});
		});
		return brackets;
	}
	function startNextBracket(){
		let bracket = _brackets.shift();
		if(bracket !== undefined){
			if(bracket.flat().some(b => aborted.includes(b.name))){
				startNextBracket()
			}else{
				let id = bracket[0][0].name+'_'+bracket[1][0].name;
				let arena = document.createElement('iframe');
				arena.classList.add('arena');
				arena.src = '../Arena/index.html';
				arena.id = 'iframe_' + id;
				document.body.appendChild(arena);
				arena.contentWindow.addEventListener('load', () => {
					arena.contentWindow.postMessage({
						type: 'auto-run',
						id: id,
						bracket: bracket,
						settings: _tournamentSettings,
						title: document.title
					}, '*');
				});
				bracketsOngoing++;
				if(bracketsOngoing < bracketsOngoingLimit){
					startNextBracket();
				}
			}
		}
	}
	function buildTable(listOfAIs){
		while(tableContainer.firstChild){tableContainer.removeChild(tableContainer.firstChild);}
		if(0 < listOfAIs.length){
			tableSummary = document.createElement('table')
			tableSummary.classList.add('working');
			// Create base of new table.
			let table = document.createElement('table');
			table.id = 'result-table';

			// Add major table header.
			let tableRow = document.createElement('tr');
			let tableCell = document.createElement('td');
			tableCell.classList.add('cell-unused');
			tableCell.colSpan = 2;
			tableCell.rowSpan = 2;
			tableCell.innerHTML = 'Score';
			if(1 < arenaProperties.settings.general.averageOf){
				tableCell.innerHTML += ', average out of ' + arenaProperties.settings.general.averageOf + ' games.';
			}
			tableRow.appendChild(tableCell);
			let tableHeaderMajor = document.createElement('th');
			tableHeaderMajor.innerHTML = '<div>Team 1</div>';
			tableHeaderMajor.classList.add('major-header', 'ai-1');
			tableHeaderMajor.colSpan = listOfAIs.length;
			tableRow.appendChild(tableHeaderMajor);
			table.appendChild(tableRow);

			// Add base table.
			tableRow = document.createElement('tr');
			listOfAIs.forEach(function(name){
				let tableHeader = document.createElement('th');
				tableHeader.innerHTML = name;
				tableRow.appendChild(tableHeader);
			}, this);
			table.appendChild(tableRow);

			// Add base header for result.
			tableRow = document.createElement('tr');
			// Summary
			tableCell = document.createElement('td');
			tableCell.classList.add('cell-unused');
			tableCell.innerHTML = 'Summary';
			tableRow.appendChild(tableCell);
			// Team 1
			tableCell = document.createElement('th');
			tableCell.innerHTML = 'Team 1';
			tableCell.classList.add('clickable');
			tableCell.onclick = function(){sortTableSummary(1)};
			tableRow.appendChild(tableCell);
			// Team 2
			tableCell = document.createElement('th');
			tableCell.innerHTML = 'Team 2';
			tableCell.classList.add('clickable');
			tableCell.onclick = function(){sortTableSummary(2)};
			tableRow.appendChild(tableCell);
			// Average
			tableCell = document.createElement('th');
			tableCell.innerHTML = 'Average';
			tableCell.classList.add('clickable');
			tableCell.onclick = function(){sortTableSummary(0)};
			tableRow.appendChild(tableCell);
			tableSummary.appendChild(tableRow);

			// Add major table side header.
			tableRow = document.createElement('tr');
			let tableHeaderMajorSide = document.createElement('th');
			tableHeaderMajorSide.innerHTML = '<div>Team 2</div>';
			tableHeaderMajorSide.classList.add('major-header', 'rotated', 'ai-2');
			tableHeaderMajorSide.rowSpan = listOfAIs.length;
			tableRow.appendChild(tableHeaderMajorSide);

			listOfAIs.forEach(function(name){
				let tableHeader = document.createElement('th');
				tableHeader.innerHTML = name;
				tableRow.appendChild(tableHeader);

				// Add AI to result table.
				let tableRowResult = document.createElement('tr');
				tableHeader = document.createElement('th');
				tableHeader.innerHTML = name;
				tableHeader.id = name + '_summaryHeader';
				tableRowResult.appendChild(tableHeader);

				let tableSummaryCell = document.createElement('td');
				tableSummaryCell.id = name + '_AI1';
				tableSummaryCell.classList.add('resultAI1');
				tableSummaryCell.innerHTML = '0.0';
				tableSummaryCell.dataset.score = 0;
				tableRowResult.appendChild(tableSummaryCell);

				tableSummaryCell = document.createElement('td');
				tableSummaryCell.id = name + '_AI2';
				tableSummaryCell.classList.add('resultAI2');
				tableSummaryCell.innerHTML = '0.0';
				tableSummaryCell.dataset.score = 0;
				tableRowResult.appendChild(tableSummaryCell);

				tableSummaryCell = document.createElement('td');
				tableSummaryCell.id = name + '_average';
				tableSummaryCell.classList.add('resultAverage');
				tableSummaryCell.innerHTML = '0.0';
				tableSummaryCell.dataset.score = 0;
				tableRowResult.appendChild(tableSummaryCell);

				tableSummary.appendChild(tableRowResult);
				listOfAIs.forEach(function(_name){
					let tableCell = document.createElement('td');
					tableCell.id = _name + '_' + name;
					tableCell.classList.add('score-cell');
					tableCell.classList.add(name);
					tableCell.classList.add(_name);
					tableCell.dataset.team1 = _name;
					tableCell.dataset.team2 = name;
					tableCell.addEventListener('click', mouseEvent=>{
						if(tableCell.dataset.log !== undefined){
							window.open('../Replay/#'+tableCell.dataset.log, '_blank').focus();
						}
					});
					tableRow.appendChild(tableCell);
				}, this);
				table.appendChild(tableRow);
				tableRow = document.createElement('tr');
			}, this);
			tableContainer.appendChild(table);
			tableContainer.appendChild(tableSummary);
		}
	}

	function updateSummaryTable(){
		for(const cell of tableSummary.getElementsByTagName('td')){
			cell.dataset.score = 0;
		}
		for(const cell of document.getElementById('result-table').getElementsByTagName('td')){
			if(cell.dataset.score !== undefined){
				JSON.parse(cell.dataset.score).forEach(function(ai, index){
					let aiNumber = index + 1;
					let aiName = ai.name;
					let score = ai.score;
					let cellScore = document.getElementById(aiName + '_AI' + aiNumber);
					let oldScore = parseFloat(cellScore.dataset.score);
					let newScore = oldScore + score;
					cellScore.dataset.score = newScore;
					cellScore.innerHTML = round(newScore, 1);
					// Set average
					let scoreAI_1 = parseFloat(document.getElementById(aiName + '_AI1').dataset.score);
					let scoreAI_2 = parseFloat(document.getElementById(aiName + '_AI2').dataset.score);
					document.getElementById(aiName + '_average').innerHTML = round((scoreAI_1 + scoreAI_2)/2, 1);
				}, this);
			}
		}
		sortTableSummary(0);
	}

	function sortTableSummary(ai){
		let column;
		switch(ai){
			case 1:
				column = 'resultAI1';
				break;
		
			case 2:
				column = 'resultAI2';
				break;
		
			default:
				column = 'resultAverage';
		}
		let rows = tableSummary.childNodes;
		rows = [].slice.call(rows, 1);
		rows.sort(function(a, b){
			let aValue = parseFloat(a.getElementsByClassName(column)[0].childNodes[0].data);
			let bValue = parseFloat(b.getElementsByClassName(column)[0].childNodes[0].data);
			if(bValue < aValue) return -1;
			if(aValue < bValue) return 1;
			return 0;
		});
		// Remove and readd.
		let header = tableSummary.firstChild;
		while(tableSummary.firstChild){tableSummary.removeChild(tableSummary.firstChild);}
		tableSummary.appendChild(header);
		rows.forEach(function(row){
			tableSummary.appendChild(row);
		}, this);
		// Mark sorted column
		tableSummary.childNodes.forEach(function(rowNodes){
			rowNodes.childNodes.forEach(function(columnNode){
				columnNode.classList.remove('sorted');
				if(columnNode.classList.contains(column)){
					columnNode.classList.add('sorted');
				}
			}, this);
		}, this);
	}
	function round(value, decimals){
		var hadDecimal = 0 < value%1;
		var base = Math.pow(10, decimals);
		var newValue = Math.round(value*base)/base;
		return newValue + (newValue%1 == 0 && hadDecimal ? '.0' : '')
	}
}
