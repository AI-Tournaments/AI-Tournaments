'use strict'
function a(){
	let _replayData;
	let _autoStart = false;
	let _element_control = document.getElementById('control-container');
	let _element_viewOptions = document.getElementById('replay-viewers');
	let _element_iframe = document.getElementById('replay-container');
	let _element_iframe_failToLoad = document.getElementById('replay-container-failToLoad');
	let _element_btnLock = document.getElementById('lock');
	let _element_editor = document.getElementById('editor');
	let _parent = null;
	let _replayOptionsPromise_resolve;
	let _replayOptionsPromise = new Promise(resolve=>_replayOptionsPromise_resolve=resolve);
	let _editor = new JSONEditor(_element_editor, {'modes': ['code', 'view'], 'name': 'matchLog', 'onChange': onChange, 'onValidate': onValidate});
	setTimeout(()=>{
		if(_editor.getText() === '{}'){
			_element_editor.classList.remove('hidden');
		}
	}, 1000);
	window.onmessage = messageEvent => {
		// NOTE: messageEvent can come from off site scripts.
		switch(messageEvent.data.type){
			case 'Init-Fetch-Replay-Height':
				if(_parent === null){
					document.documentElement.style.paddingLeft = 0;
					document.documentElement.style.paddingRight = 0;
					document.documentElement.style.paddingBottom = 0;
					_parent = {
						origin: messageEvent.origin,
						source: messageEvent.source
					}
				}
			case 'Replay-Height':
				if(messageEvent.data.value !== undefined){
					_element_iframe.style.minHeight = parseFloat(messageEvent.data.value)+'px';
					_element_iframe.classList.remove('hidden');
					_element_iframe_failToLoad.classList.add('hidden');
				}
				if(_parent !== null){
					_parent.source.postMessage({type: 'Replay-Height', value: document.documentElement.scrollHeight}, _parent.origin);
				}
				break;
			case 'Replay-Data':
				_editor.setText(messageEvent.data.replayData);
				_autoStart = true;
				onChange();
				break;
		}
	}
	_element_btnLock.onclick = mouseEvent=>{
		_element_btnLock.disabled = true;
		_editor.setMode('view');
		for(const input of document.getElementsByClassName('select-match-button')){
			input.disabled = input.dataset.aborted === 'true';
		}
		_replayOptionsPromise_resolve(GitHubApi.fetch('search/repositories?q=topic:AI-Tournaments+topic:AI-Tournaments-Replay+topic:'+_replayData.body.arena.full_name.replace('/','--')).then(response => response.json()).then(response => {
			document.getElementById('default-option').value = _replayData.header !== undefined && _replayData.header.defaultReplay !== undefined && _replayData.header.defaultReplay !== '' ? _replayData.header.defaultReplay : 'https://ai-tournaments.github.io/'+_replayData.body.arena.full_name.split('/')[1].replace('Arena','Replay')+'/';
			response.items.forEach(repo => {
				if(repo.has_pages){
					let cssStar = getComputedStyle(document.documentElement).getPropertyValue('--github-stars').trim();
					cssStar = cssStar.substring(1,cssStar.length-1);
					let option = document.createElement('option');
					option.innerHTML = repo.full_name.replace(/.*\/|-Arena/g, '') + ' ' + cssStar + repo.stars;
					option.dataset.stars = repo.stars;
					option.value = 'https://'+repo.owner.login+'.github.io/'+repo.name;
					_element_viewOptions.appendChild(option);
				}
			});
			let options = [..._element_viewOptions.options];
			options.sort(function(a, b){
				if(parseFloat(a.dataset.stars) < parseFloat(b.dataset.stars)){return -1;}
				if(parseFloat(b.dataset.stars) < parseFloat(a.dataset.stars)){return 1;}
				return 0;
			});
			_element_viewOptions.classList.remove('hidden');
		}));
	};
	function onValidate(json){
		function isUrl(string){
			let url;
			try{
				url = new URL(string);
			}catch(e){
				return false;
			}
			return url.protocol === "http:" || url.protocol === "https:";
		}
		let errors = [];
		if(json.header !== undefined && json.header.defaultReplay !== undefined && !isUrl(json.header.defaultReplay)){
			errors.push({
				path: ['header'],
				message: 'Property "defaultReplay" is not a URL.'
			});
		}
		if(json.body === undefined || typeof json.body.data !== 'object'){
			errors.push({
				path: ['body'],
				message: 'Property "data" is missing or not a array.'
			});
		}
		return errors;
	}
	function onChange(){
		_editor.validate().then(errors => {
			let containsError = 0 < errors.length;
			[...document.getElementsByClassName('select-match-button')].forEach(input=>{
				input.parentElement.removeChild(input);
			});
			_element_btnLock.disabled = containsError;
			document.getElementById('invalid-input').classList[containsError ? 'remove' : 'add']('hidden');
			if(containsError){
				_element_editor.classList.remove('hidden');
			}else{
				_replayData = _editor.get();
				_replayData.body.data.forEach((matchLog, index) => {
					let input = document.createElement('input');
					input.type = 'button';
					input.value = 'Match ' + (index+1);
					let aborted = matchLog === null;
					if(aborted){
						input.value += ' (aborted)';
					}
					input.dataset.aborted = aborted;
					input.disabled = true;
					input.classList.add('select-match-button');
					input.classList.add('sticky');
					function onClick(mouseEvent){
						for(const matchButton of document.getElementsByClassName('select-match-button')){
							if(matchButton !== input && matchButton.dataset.aborted !== 'true'){
								matchButton.disabled = false;
							}
						}
						for(const element of _element_control.children){
							if(!element.classList.contains('sticky')){
								element.classList.add('hidden');
							}
						}
						_element_iframe.src = _element_viewOptions.selectedOptions[0].value;
						setTimeout(()=>{
							_element_iframe.contentWindow.postMessage({type: 'Init-Fetch-Replay-Height'}, '*');
							_element_iframe.contentWindow.postMessage({type: 'Match-Log', matchLog: matchLog}, '*');
							setTimeout(()=>{
								if(_element_iframe.classList.contains('hidden')){
									_element_iframe_failToLoad.classList.remove('hidden');
								}
							}, 1000);
						}, 1000);
						input.disabled = true;
					}
					input.addEventListener('click', onClick);
					_element_control.appendChild(input);
					if(_replayData.body.data.length === 1){
						input.classList.add('hidden');
						_replayOptionsPromise.then(onClick);
					}
				});
			}
			if(_autoStart){
				_autoStart = false;
				if(!containsError){
					_element_btnLock.onclick();
				}
			}
		});
	}
}
