'use strict'
function a(){
	let arenaProperties;
	let arenaList = document.getElementById('arena-datalist');
	let participantList = document.getElementById('participants-selectable');
	let outputSum = document.getElementById('outputSum');
	let participantsSelected = document.getElementById('participants-selected');
	let btnStart = document.getElementById('btnStart');
	btnStart.onclick = start;
	for(const button of document.getElementsByClassName('transfer-button')){
		button.onclick = transferTo;
	}
	let contentWindows = {
		arena: [],
		iFrameLog: []
	};
	document.getElementById('arena').onchange = event => {
		let option = getOption(arenaList, event);
		if(option !== undefined){
			for(const element of document.getElementsByClassName('participant-team-container')){
				element.parentNode.removeChild(element);
			}
			document.title = event.target.value + ' Arena';
			getParticipants(option.value);
		}
	}
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
		if(contentWindows.arena.includes(messageEvent.source)){
			getArenaLog(messageEvent);
		}else if(messageEvent.data.type === 'log'){
			document.getElementById(messageEvent.data.value.id + '_output').innerHTML = JSON.stringify(messageEvent.data.value.log,null,'\t');
		}else{
			console.error('Source element not defined!');
			console.error(messageEvent.source.frameElement);
		}
	}
	function getArenaLog(messageEvent){
		let iframe = document.getElementById(messageEvent.data.id);
		let output = iframe.parentElement.getElementsByClassName('log')[0];
		if(messageEvent.origin === 'null'){
			while(0 < output.childElementCount){
				output.removeChild(output.firstChild);
			}
			let isDone = true;
			let aborted = []; // TODO: Use.
			let log = undefined;
			messageEvent.data.value.data.forEach(posts => {
				let container = document.createElement('div');
				output.appendChild(container);
				let isDone_local = false;
				let score = undefined;
				posts.forEach(post => {
					isDone_local |= post.type === 'FinalScore' || post.type === 'Aborted';
					if(post.type === 'FinalScore'){
						score = post.value.score;
						log = post.value.history;
					}else if(post.type === 'Aborted'){
						score = null;
						aborted.push(post.value);
					}
					let label = document.createElement('label');
					label.htmlFor = iframe.src + ':' + post.id;
					label.classList.add(post.type);
					label.innerHTML = post.type;
					container.appendChild(label);
					let pre = document.createElement('pre');
					pre.id = iframe.src + ':' + post.id;
					pre.classList.add(post.type);
					pre.innerHTML = JSON.stringify(post.value,null,'\t');
					container.appendChild(pre);
				});
				isDone &= isDone_local;
				if(isDone_local){
					if(score === null){
						outputSum.dataset.aborted = JSON.stringify(aborted);
					}else{
						let array = outputSum.dataset.array === undefined ? [] : JSON.parse(outputSum.dataset.array);
						score.forEach(s => {
							let entry = array.find(entry => entry.name === s.name);
							if(entry === undefined){
								entry = {type: 'score', name: s.name, score: 0, scores: []};
								array.push(entry);
							}
							entry.scores.push(s.score);
							entry.score = entry.scores.reduce(function(a,b){return a+b;})/entry.scores.length;
						});
						outputSum.dataset.array = JSON.stringify(array);
						outputSum.innerHTML = JSON.stringify(array,null,'\t');
					}
				}
			});
			if(isDone){
				let array = outputSum.dataset.array === undefined ? [] : JSON.parse(outputSum.dataset.array);
				array.push({type: 'log', log: log})
				if(outputSum.dataset.aborted !== undefined){
					array.push({type: 'aborted', aborted: aborted})
				}
				outputSum.dataset.array = JSON.stringify(array);
				outputSum.innerHTML = JSON.stringify(array,null,'\t');
				contentWindows.iFrameLog.splice(contentWindows.iFrameLog.indexOf(messageEvent.source), 1);
			}else{
				getIFrameLog(iframe);
			}
		}
	};
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
	function getParticipants(arena=''){
		for(const selectElement of document.getElementsByClassName('participants')){
			while(0 < selectElement.length){
				selectElement.remove(0);
			}
		}
		let promises = [];
		fetch('https://api.github.com/repos/AI-Tournaments/'+arena+'-AI-Tournament-Participant/forks').then(response => response.json()).then(forks => {
			forks.forEach(fork => {
				promises.push(fetch('https://api.github.com/repos/' + fork.full_name + '/git/trees/master')
				.then(response => response.json())
				.then(data => {
					data.tree.forEach(file =>{
						if(!file.path.startsWith('.') && file.type === 'blob' && file.path.endsWith('.js')){
							let option = document.createElement('option');
							option.dataset.name = fork.full_name + '/' + file.path;
							option.dataset.url = 'https://raw.githubusercontent.com/' + fork.full_name + '/' + fork.default_branch + '/' + file.path;
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
		let participants = [];
		for(const option of participantsSelected.options){
			participants.push({
				name: option.dataset.name,
				url: option.dataset.url
			});
		}
		let brackets = buildBrackets(participants, arenaProperties.header);
		brackets.forEach(bracket => {
			let div = document.createElement('div');
			document.getElementById('logContainer').appendChild(div);
			let iframe = document.createElement('iframe');
			iframe.src = '../Arena/index.html';
			iframe.style.display = 'none';
			iframe.id = Date() + '_' +  Math.random();
			div.appendChild(iframe);
			let output = document.createElement('pre');
			output.id = iframe.id + '_output';
			output.style.display = 'none';
			output.classList.add('log');
			div.appendChild(output);
			contentWindows.iFrameLog.push(iframe.contentWindow);
			iframe.contentWindow.addEventListener('load', () => {
				iframe.contentWindow.postMessage({
					type: 'auto-run',
					id: iframe.id,
					bracket: bracket,
					settings: arenaProperties.settings,
					title: document.title
				}, '*');
			});
		});
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
}
