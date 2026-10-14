#!/usr/bin/env python3
"""Verify quote CSS in a running Obsidian; restore all temporary DOM/settings.

Open a Reading View containing a blockquote before running. No notes, settings,
theme selection or scroll positions are saved/changed by this probe.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--vault', default='AI-native Knowledge System')
parser.add_argument('--out', type=pathlib.Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)


def cli(*command):
    # Electron can inherit pipe handles; files avoid waiting on unrelated app IO.
    with tempfile.TemporaryFile(mode='w+') as stdout, tempfile.TemporaryFile(mode='w+') as stderr:
        subprocess.run(['obsidian', f'vault={args.vault}', *command],
                       stdout=stdout, stderr=stderr, check=True, timeout=30)
        stdout.seek(0); stderr.seek(0)
        text, errors = stdout.read(), stderr.read()
    if 'Error:' in text or 'Error:' in errors:
        raise RuntimeError(text + errors)
    return text.strip()


def evaluate(code):
    return json.loads(cli('eval', 'code=' + code).removeprefix('=> '))


cli('dev:debug', 'on')
try:
    context = evaluate("JSON.stringify({path:app.vault.adapter.basePath,theme:app.customCss.theme})")
    data = pathlib.Path(context['path']) / '.obsidian/plugins/crisp-craft/data.json'
    def digest():
        return hashlib.sha256(data.read_bytes()).hexdigest() if data.exists() else None
    before = digest()
    results = evaluate('''(async()=>{
 const plugin=app.plugins.plugins['crisp-craft'];
 if(!plugin) throw new Error('Enable Crisp Craft before running this probe');
 const quote=[...document.querySelectorAll('.markdown-reading-view .markdown-preview-section blockquote')]
   .find(q=>q.getBoundingClientRect().width>0);
 if(!quote) throw new Error('Open a Reading View containing a visible blockquote');
 const root=quote.closest('.markdown-reading-view');
 const settings=structuredClone(plugin.settings);
 const text=quote.textContent;
 const geometry=quote.getBoundingClientRect();
 const result={theme:app.customCss.theme,version:plugin.manifest.version,cases:[]};
 const fixture=document.createElement('div');
 fixture.className='markdown-preview-section markdown-rendered';
 fixture.style.cssText='position:fixed;left:-10000px;top:0;width:600px;pointer-events:none';
 fixture.innerHTML='<blockquote><p>Outer</p><blockquote><p>Nested</p></blockquote></blockquote><div class="callout" data-callout="note"><div class="callout-title">Callout</div></div><div class="callout cc-divider-callout" data-callout="divider">Divider</div>';
 root.append(fixture);
 const editor=document.createElement('div');
 editor.className='markdown-source-view markdown-rendered';
 editor.style.cssText=fixture.style.cssText;
 editor.innerHTML='<blockquote><p>Editor embed</p></blockquote>';
 document.body.append(editor);
 const state=(e)=>{
   const s=getComputedStyle(e),b=getComputedStyle(e,'::before');
   return {display:b.display,content:b.content,width:b.width,background:b.backgroundColor,
     borderLeft:s.borderLeftWidth,borderColor:s.borderLeftColor,radius:s.borderRadius};
 };
 const editorBefore=state(editor.firstElementChild);
 const note=fixture.querySelector('.callout[data-callout="note"]');
 const divider=fixture.querySelector('[data-callout="divider"]');
 // rAF pauses when Obsidian is in the background.
 const frames=()=>new Promise(r=>setTimeout(r,150));
 try {
   plugin.settings.enabled=true;plugin.settings.quote.enabled=false;
   plugin.refreshReadingViews();await frames();
   const native=state(quote);
   result.native=native;
   for(const style of ['glass-edge','edge','minimal']){
     plugin.settings.quote.enabled=true;plugin.settings.quote.style=style;
     plugin.refreshReadingViews();await frames();
     const calloutBefore=state(note),dividerBefore=state(divider);
     const top=state(quote),nested=state(fixture.querySelector('blockquote blockquote'));
     const borderExpected=style==='minimal'?'0px':'3px';
     result.cases.push({style,top,nested,
       pass:top.display==='none'&&nested.display==='none'&&top.borderLeft===borderExpected});
     // Counterfactual: remove only the new rule, leaving preset rules intact.
     const counter=document.createElement('style');
     counter.textContent='.markdown-reading-view.crisp-craft-enabled[data-cc-quote-style] .markdown-preview-section blockquote::before { display:block !important; }';
     document.head.append(counter);
     try {
       result.cases.push({style:style+' callout boundary',pass:
         JSON.stringify(state(note))===JSON.stringify(calloutBefore)&&
         JSON.stringify(state(divider))===JSON.stringify(dividerBefore)});
     } finally { counter.remove(); }
   }
   plugin.settings.quote.enabled=false;plugin.refreshReadingViews();await frames();
   result.cases.push({style:'quote disabled',pass:JSON.stringify(state(quote))===JSON.stringify(native)});
   plugin.settings.quote.enabled=true;plugin.settings.enabled=false;
   plugin.refreshReadingViews();await frames();
   result.cases.push({style:'plugin styling disabled',pass:JSON.stringify(state(quote))===JSON.stringify(native)});
   result.cases.push({style:'editor unaffected',pass:JSON.stringify(state(editor.firstElementChild))===JSON.stringify(editorBefore)});
 } finally {
   plugin.settings=settings;fixture.remove();editor.remove();
   plugin.refreshReadingViews();await frames();
 }
 const restored=quote.getBoundingClientRect();
 result.cases.push({style:'text and layout restored',pass:quote.textContent===text&&
   Math.abs(restored.width-geometry.width)<0.1&&Math.abs(restored.height-geometry.height)<0.1});
 result.pass=result.cases.every(c=>c.pass);
 return JSON.stringify(result);
})()''')
    cli('dev:screenshot', 'path=' + str((args.out / 'reading.png').resolve()))
    results['dataBefore'] = before
    results['dataAfter'] = digest()
    results['pass'] = results['pass'] and before == results['dataAfter']
    (args.out / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'pass': results['pass'], 'cases': len(results['cases']),
                      'artifact': str((args.out / 'results.json').resolve())}))
    raise SystemExit(0 if results['pass'] else 1)
finally:
    cli('dev:debug', 'off')
