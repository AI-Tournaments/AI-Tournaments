'use strict'
class GitHubApi{
	static #ARENA_VERSION = 1;
	static #CLIENT_ID = '19698a5006b153e8a671';
	static #STARTED = localStorage.getItem('PageLoaded');
	static #waitUntil = timestamp => new Promise(resolve => setTimeout(resolve, timestamp-Date.now()));
	static getClientId(){
		return GitHubApi.#CLIENT_ID;
	}
	static fetch(path='', init={}){
		let token = localStorage.getItem('GitHub OAuth-Token');
		if(token !== null && token !== undefined && token[0] !== '!'){
			if(init.headers === undefined){
				init.headers = {};
			}
			if(init.headers.Authorization === undefined){
				init.headers.Authorization = 'token '+token;
			}
		}
		return fetch(new Request('https://api.github.com/'+path, init)).then(response => {
			if(localStorage.getItem('GitHub API debug') !== null){
				let a = path.split('/')[0];
				let reset = localStorage.getItem('_GitHub '+a+' x-ratelimit-reset');
				if(response.headers.has('x-ratelimit-reset')){
					reset = reset !== response.headers.get('x-ratelimit-reset');
					localStorage.setItem('_GitHub '+a+' x-ratelimit-reset', response.headers.get('x-ratelimit-reset'));
				}
				if(response.headers.has('x-ratelimit-used')){
					let b = parseInt(response.headers.get('x-ratelimit-used'));
					let value = reset ? b : Math.max(parseInt(localStorage.getItem('_GitHub '+a+' x-ratelimit-used')), b);
					localStorage.setItem('_GitHub '+a+' x-ratelimit-used', value);
				}
				if(response.headers.has('x-ratelimit-remaining')){
					let b = parseInt(response.headers.get('x-ratelimit-remaining'));
					let value = reset ? b : Math.max(parseInt(localStorage.getItem('_GitHub '+a+' x-ratelimit-remaining')), b);
					localStorage.setItem('_GitHub '+a+' x-ratelimit-remaining', value);
				}
				if(response.headers.has('x-ratelimit-limit')){
					let b = parseInt(response.headers.get('x-ratelimit-limit'));
					let value = reset ? b : Math.max(parseInt(localStorage.getItem('_GitHub '+a+' x-ratelimit-limit')), b);
					localStorage.setItem('_GitHub '+a+' x-ratelimit-limit', value);
				}
			}
			if(response.status === 200){
				return response;
			}else if(response.status === 401){
				localStorage.removeItem('GitHub OAuth-Token');
				throw new Error('Unauthorized GitHub OAuth-Token. Logged out.');
			}else if([403, 429/*Unconfirmed*/].includes(response.status)){
				let timestamp = 1000*(parseInt(response.headers.get('x-ratelimit-reset'))+1);
				if(this.isLoggedIn()){
					localStorage.setItem('PopupMessage-'+this.#STARTED+timestamp, 'GitHub API rate limit reached\n424px\nWait until the <a href="https://docs.github.com/en/free-pro-team@latest/rest/reference/rate-limit" target="_blank">API rate limit</a> timer resets: <time class="countdown" datetime="'+new Date(timestamp)+'"></time>');
				}else{
					localStorage.setItem('PopupMessage-'+this.#STARTED+timestamp, 'GitHub API rate limit reached\n371px\nGitHub has a lower <a href="https://docs.github.com/en/free-pro-team@latest/rest/reference/rate-limit" target="_blank">API rate limit</a> for unsigned requests. <a href="https://ai-tournaments.github.io/AI-Tournaments/login">Login</a> to be able to continue to create matches or wait until the timer resets: <time class="countdown" datetime="'+new Date(timestamp)+'"></time>');
				}
				return this.#waitUntil(timestamp).then(()=>GitHubApi.fetch(path, init));
			}
			throw new Error('Uncaught response: ' + response.status + ' ' + response.statusText);
		});
	}
	static fetchArenas(){
		return GitHubApi.fetch('search/repositories?q=topic:AI-Tournaments+topic:AI-Tournaments-Arena-v'+GitHubApi.#ARENA_VERSION).then(response => response.json()).then(json => {
			let arenas = [];
			let promises = [];
			json.items.forEach(repo => {
				console.log('// TODO: Populate includeScripts by searching for .js-files in repo folders. E.g: includeScripts/name.arena.js and includeScripts/name.participants.js');
				let data = {
					official: repo.owner.login === 'AI-Tournaments',
					name: repo.full_name.replace(/.*\/|-Arena/g, ''),
					raw_url: null,
					preview_url: 'https://raw.githubusercontent.com/'+repo.full_name+'/'+repo.default_branch+'/',
					html_url: repo.html_url,
					full_name: repo.full_name,
					stars: repo.stargazers_count,
					commit: null,
					version: null,
					includeScripts: {arena: [], participants: []}
				};
				arenas.push(data);
				let tagPromise = GitHubApi.fetch(repo.tags_url.replace('https://api.github.com/','')).then(response => response.json());
				promises.push(GitHubApi.fetch(repo.releases_url.replace(/https:\/\/api.github.com\/|{\/id}/g,'')).then(response => response.json()).then(releases => {
					if(0 < releases.length){
						data.version = releases.sort((a,b)=>new Date(b.published_at) - new Date(a.published_at))[0].tag_name;
						data.raw_url = 'https://raw.githubusercontent.com/'+repo.full_name+'/'+data.version+'/';
						promises.push(tagPromise.then(tags => {
							let index = 0;
							while(data.commit === null){
								let tag = tags[index++];
								if(tag.name === data.version){
									data.commit = tag.commit.sha;
								}
							}
						}));
					}
				}));
			});
			return Promise.all(promises).then(()=>arenas);
		});
	}
	static login(){
		let oAuthCode = null;
		if(0 < location.href.indexOf('?oAuthCode=')){
			oAuthCode = location.href.substr(location.href.indexOf('=')+1)
		}
		let token = localStorage.getItem('GitHub OAuth-Token');
		if(token !== null && token[0] === '!'){
			localStorage.removeItem('GitHub OAuth-Token')
		}
		if(oAuthCode !== null){
			localStorage.setItem('GitHub OAuth-Token', '!'+oAuthCode);
			let init = {
				'method': 'POST',
				'body': JSON.stringify({
					'oAuthCode': oAuthCode,
					'client_id': GitHubApi.#CLIENT_ID
				})
			};
			fetch(new Request('https://ai-tournaments.azurewebsites.net/api/GitHub-Login'), init).then(response => response.text()).then(accessToken => {
				if(accessToken !== ''){
					localStorage.setItem('GitHub OAuth-Token', accessToken);
				}
				location.replace(location.protocol+'//'+location.host+location.pathname);
			}).catch(error => {
				console.error(error);
				localStorage.removeItem('GitHub OAuth-Token');
			});
		}
	}
	static isLoggedIn(){
		return localStorage.getItem('GitHub OAuth-Token') !== null;
	}
}
