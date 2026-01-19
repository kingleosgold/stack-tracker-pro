/**
 * Expo Config Plugin for WidgetKit Native Module
 *
 * This plugin copies the WidgetKitModule native bridge files to the iOS project
 * and adds them to the Xcode project's compile sources.
 * The widget extension itself is handled by @bacons/apple-targets.
 *
 * Without this plugin, NativeModules.WidgetKitModule would be undefined,
 * and widget data would never be synced to the App Group.
 */

const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Copy WidgetKitModule native files to iOS project
 */
const withCopyNativeFiles = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosPath = path.join(projectRoot, 'ios');
      const projectName = config.modRequest.projectName || 'StackTrackerPro';
      const targetDir = path.join(iosPath, projectName);

      // Create target directory if it doesn't exist
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Source directory containing the native module files
      const pluginDir = path.join(projectRoot, 'plugins', 'ios-widget', 'widget-files');

      const nativeModuleFiles = ['WidgetKitModule.swift', 'WidgetKitModule.m'];

      for (const fileName of nativeModuleFiles) {
        const srcPath = path.join(pluginDir, fileName);
        const destPath = path.join(targetDir, fileName);

        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`[WidgetNativeModule] Copied ${fileName} to iOS project`);
        } else {
          console.warn(`[WidgetNativeModule] Warning: ${fileName} not found at ${srcPath}`);
        }
      }

      return config;
    },
  ]);
};

/**
 * Add the native module files to the Xcode project's compile sources
 */
const withAddToXcodeProject = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName || 'StackTrackerPro';

    try {
      // Find the main app target UUID
      const targets = xcodeProject.pbxNativeTargetSection();
      let mainTargetUuid = null;

      for (const [uuid, target] of Object.entries(targets)) {
        if (target && typeof target === 'object' && target.name === `"${projectName}"`) {
          mainTargetUuid = uuid;
          console.log(`[WidgetNativeModule] Found main target: ${projectName} (${uuid})`);
          break;
        }
      }

      if (!mainTargetUuid) {
        console.log('[WidgetNativeModule] Could not find main target, will try adding without target');
      }

      // Find the main app group in the project
      const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;
      const projectGroup = xcodeProject.getPBXGroupByKey(mainGroup);

      if (!projectGroup) {
        console.log('[WidgetNativeModule] Could not find main project group');
        return config;
      }

      // Find the app group under the project
      let appGroupKey = null;
      if (projectGroup.children) {
        for (const child of projectGroup.children) {
          if (child.comment === projectName) {
            appGroupKey = child.value;
            break;
          }
        }
      }

      if (!appGroupKey) {
        console.log(`[WidgetNativeModule] Could not find ${projectName} group, using main group`);
        appGroupKey = mainGroup;
      }

      // Files to add to the project
      const filesToAdd = [
        { name: 'WidgetKitModule.swift', path: `${projectName}/WidgetKitModule.swift` },
        { name: 'WidgetKitModule.m', path: `${projectName}/WidgetKitModule.m` },
      ];

      for (const file of filesToAdd) {
        // Check if file already exists in the project
        const existingFile = xcodeProject.hasFile(file.path);

        if (existingFile) {
          console.log(`[WidgetNativeModule] ${file.name} already in project`);
          continue;
        }

        // Add the file to the project with the correct target
        // Using the full API to ensure it's added to compile sources
        const fileOptions = mainTargetUuid ? { target: mainTargetUuid } : {};

        xcodeProject.addSourceFile(
          file.path,
          fileOptions,
          appGroupKey
        );

        console.log(`[WidgetNativeModule] Added ${file.name} to Xcode project`);
      }

      // Verify files were added to compile sources
      const buildPhases = xcodeProject.pbxSourcesBuildPhaseSection();
      let filesInBuildPhase = 0;
      for (const [, phase] of Object.entries(buildPhases)) {
        if (phase && phase.files && Array.isArray(phase.files)) {
          for (const buildFile of phase.files) {
            if (buildFile.comment && buildFile.comment.includes('WidgetKitModule')) {
              filesInBuildPhase++;
            }
          }
        }
      }
      console.log(`[WidgetNativeModule] Files in compile sources: ${filesInBuildPhase}`);

    } catch (error) {
      console.error('[WidgetNativeModule] Error adding files to Xcode project:', error.message);
      console.error('[WidgetNativeModule] Stack:', error.stack);
    }

    return config;
  });
};

/**
 * Ensure the bridging header exists and includes React
 */
const withBridgingHeader = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName || 'StackTrackerPro';
      const bridgingHeaderPath = path.join(
        projectRoot,
        'ios',
        projectName,
        `${projectName}-Bridging-Header.h`
      );

      // Check if bridging header exists, if not create one
      if (!fs.existsSync(bridgingHeaderPath)) {
        const bridgingHeaderContent = `//
//  ${projectName}-Bridging-Header.h
//  ${projectName}
//
//  Auto-generated bridging header for Swift/Objective-C interop
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
`;
        fs.writeFileSync(bridgingHeaderPath, bridgingHeaderContent);
        console.log(`[WidgetNativeModule] Created bridging header at ${bridgingHeaderPath}`);
      } else {
        // Verify it has the required imports
        const content = fs.readFileSync(bridgingHeaderPath, 'utf8');
        if (!content.includes('RCTBridgeModule')) {
          const updatedContent = content + '\n#import <React/RCTBridgeModule.h>\n';
          fs.writeFileSync(bridgingHeaderPath, updatedContent);
          console.log('[WidgetNativeModule] Added RCTBridgeModule import to bridging header');
        } else {
          console.log('[WidgetNativeModule] Bridging header already has required imports');
        }
      }

      return config;
    },
  ]);
};

/**
 * Set bridging header in build settings
 */
const withBridgingHeaderBuildSetting = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName || 'StackTrackerPro';

    try {
      const bridgingHeaderPath = `${projectName}/${projectName}-Bridging-Header.h`;

      // Get all build configurations
      const buildConfigs = xcodeProject.pbxXCBuildConfigurationSection();

      for (const [key, buildConfig] of Object.entries(buildConfigs)) {
        if (buildConfig && buildConfig.buildSettings) {
          // Only set for app target configs (not widget or other targets)
          // Check if this is likely the main app target by looking at PRODUCT_NAME
          const productName = buildConfig.buildSettings.PRODUCT_NAME;
          if (productName === `"${projectName}"` || productName === `"$(TARGET_NAME)"`) {
            if (!buildConfig.buildSettings.SWIFT_OBJC_BRIDGING_HEADER) {
              buildConfig.buildSettings.SWIFT_OBJC_BRIDGING_HEADER = `"${bridgingHeaderPath}"`;
              console.log(`[WidgetNativeModule] Set bridging header for config: ${buildConfig.name || key}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('[WidgetNativeModule] Error setting bridging header:', error.message);
    }

    return config;
  });
};

/**
 * Main plugin export
 */
const withWidgetNativeModule = (config) => {
  config = withCopyNativeFiles(config);
  config = withBridgingHeader(config);
  config = withAddToXcodeProject(config);
  config = withBridgingHeaderBuildSetting(config);
  return config;
};

module.exports = withWidgetNativeModule;
