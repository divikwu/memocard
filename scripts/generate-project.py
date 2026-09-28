#!/usr/bin/env python3
"""Generate the small two-target Xcode project using only Python's standard library."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
objects = {}
def ident(name): return hashlib.sha256(name.encode()).hexdigest()[:24].upper()
def add(key_name, isa, **values):
    key=ident(key_name); objects[key]={'isa':isa, **values}; return key

def configs(name, target=None):
    configs=[]
    for mode in ['Debug','Release']:
        settings={'SWIFT_VERSION':'5.0','CLANG_ENABLE_MODULES':'YES','SWIFT_STRICT_CONCURRENCY':'minimal','MACOSX_DEPLOYMENT_TARGET':'14.0','IPHONEOS_DEPLOYMENT_TARGET':'17.0'}
        if mode=='Debug': settings.update({'SWIFT_OPTIMIZATION_LEVEL':'-Onone','SWIFT_ACTIVE_COMPILATION_CONDITIONS':'DEBUG','ONLY_ACTIVE_ARCH':'YES'})
        else: settings.update({'SWIFT_COMPILATION_MODE':'wholemodule','SWIFT_OPTIMIZATION_LEVEL':'-O'})
        if target:
            mac=target=='Mac'
            settings.update({'PRODUCT_NAME':'MemoCard','PRODUCT_BUNDLE_IDENTIFIER':'dev.divikwu.memocard','GENERATE_INFOPLIST_FILE':'YES','INFOPLIST_FILE':'Config/Info.plist','CODE_SIGN_STYLE':'Automatic','MARKETING_VERSION':'0.1.0','CURRENT_PROJECT_VERSION':'1','SDKROOT':'macosx' if mac else 'iphoneos','SUPPORTED_PLATFORMS':'macosx' if mac else 'iphoneos iphonesimulator','ENABLE_HARDENED_RUNTIME':'YES' if mac else 'NO','LD_RUNPATH_SEARCH_PATHS':['$(inherited)','@executable_path/../Frameworks' if mac else '@executable_path/Frameworks'],'SWIFT_EMIT_LOC_STRINGS':'YES'})
            if mac: settings.update({'CODE_SIGN_ENTITLEMENTS':'Config/Mac.entitlements','COMBINE_HIDPI_IMAGES':'YES'})
            else: settings.update({'TARGETED_DEVICE_FAMILY':'1,2','SUPPORTS_MACCATALYST':'NO','INFOPLIST_KEY_UIApplicationSceneManifest_Generation':'YES','INFOPLIST_KEY_UILaunchScreen_Generation':'YES'})
        configs.append(add(name+mode,'XCBuildConfiguration',name=mode,buildSettings=settings))
    return add(name+'configlist','XCConfigurationList',buildConfigurations=configs,defaultConfigurationIsVisible='0',defaultConfigurationName='Release')

source_names=['MemoCardApp.swift','NativeHost.swift','LocalReadServer.swift','LocalWebServer.swift','WebView.swift']
source_refs=[add('src'+n,'PBXFileReference',lastKnownFileType='sourcecode.swift',path=n,sourceTree='<group>') for n in source_names]
sources=add('Sources','PBXGroup',path='Sources',sourceTree='<group>',children=source_refs)
web=add('Web','PBXFileReference',lastKnownFileType='folder',path='Resources/Web',sourceTree='<group>')
package=add('core-package','XCLocalSwiftPackageReference',relativePath='../../packages/native-core')
product_refs=[]; targets=[]
for platform in ['Mac','iOS']:
    product=add(platform+'product','PBXFileReference',explicitFileType='wrapper.application',path='MemoCard.app',sourceTree='BUILT_PRODUCTS_DIR'); product_refs.append(product)
    source_builds=[add(platform+n,'PBXBuildFile',fileRef=r) for n,r in zip(source_names,source_refs)]
    dependency=add(platform+'core','XCSwiftPackageProductDependency',package=package,productName='MemoCardCore')
    link=add(platform+'link','PBXBuildFile',productRef=dependency)
    phases=[add(platform+'sources','PBXSourcesBuildPhase',buildActionMask='2147483647',files=source_builds,runOnlyForDeploymentPostprocessing='0'),add(platform+'frameworks','PBXFrameworksBuildPhase',buildActionMask='2147483647',files=[link],runOnlyForDeploymentPostprocessing='0'),add(platform+'resources','PBXResourcesBuildPhase',buildActionMask='2147483647',files=[add(platform+'webbuild','PBXBuildFile',fileRef=web)],runOnlyForDeploymentPostprocessing='0')]
    target=add('target'+platform,'PBXNativeTarget',name='MemoCard'+platform,productName='MemoCard',productType='com.apple.product-type.application',productReference=product,buildConfigurationList=configs(platform,platform),buildPhases=phases,buildRules=[],dependencies=[],packageProductDependencies=[dependency]); targets.append(target)
products=add('Products','PBXGroup',name='Products',sourceTree='<group>',children=product_refs)
main=add('Main','PBXGroup',sourceTree='<group>',children=[sources,web,products])
project=add('project','PBXProject',attributes={'BuildIndependentTargetsInParallel':'YES','LastUpgradeCheck':'2700'},buildConfigurationList=configs('project'),compatibilityVersion='Xcode 14.0',developmentRegion='zh-Hans',hasScannedForEncodings='0',knownRegions=['zh-Hans','en','Base'],mainGroup=main,productRefGroup=products,projectDirPath='',projectRoot='',targets=targets,packageReferences=[package])
def serialize(v,level=0):
    pad='\t'*level
    if isinstance(v,dict): return '{\n'+''.join(pad+'\t'+json.dumps(k)+' = '+serialize(x,level+1)+';\n' for k,x in v.items())+pad+'}'
    if isinstance(v,list): return '(\n'+''.join(pad+'\t'+serialize(x,level+1)+',\n' for x in v)+pad+')'
    return json.dumps(v)
project_dir=root/'apps/apple/MemoCard.xcodeproj'; project_dir.mkdir(parents=True,exist_ok=True)
(project_dir/'project.pbxproj').write_text('// !$*UTF8*$!\n'+serialize({'archiveVersion':'1','classes':{},'objectVersion':'56','objects':objects,'rootObject':project})+'\n')
scheme_dir=project_dir/'xcshareddata/xcschemes'; scheme_dir.mkdir(parents=True,exist_ok=True)
for platform,target in zip(['Mac','iOS'],targets):
    name='MemoCard'+platform
    ref=f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="MemoCard.app" BlueprintName="{name}" ReferencedContainer="container:MemoCard.xcodeproj"/>'
    (scheme_dir/(name+'.xcscheme')).write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2700" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{ref}</BuildActionEntry></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>
''')
print('Generated MemoCardMac and MemoCardiOS targets.')
