import WidgetKit
import SwiftUI

/// Main widget bundle containing all widget sizes
@main
struct StackTrackerWidgetBundle: WidgetBundle {
    var body: some Widget {
        StackTrackerWidget()
    }
}

/// Stack Tracker Portfolio Widget
struct StackTrackerWidget: Widget {
    let kind: String = "StackTrackerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            StackTrackerWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Stack Tracker Gold")
        .description("View your precious metals portfolio value and live spot prices.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

/// Timeline provider for widget data
/// NOTE: Widget ONLY reads from App Group storage - it NEVER makes API calls directly.
/// The app is responsible for fetching prices and updating App Group storage.
struct Provider: TimelineProvider {
    private let appGroupId = "group.com.stacktrackerpro.shared"

    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(
            date: Date(),
            data: WidgetData.placeholder
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        let entry = WidgetEntry(
            date: Date(),
            data: loadWidgetData()
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        let currentDate = Date()
        let data = loadWidgetData()

        let entry = WidgetEntry(
            date: currentDate,
            data: data
        )

        // Request refresh every 15 minutes
        // Widget will re-read from App Group storage at that time
        let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate)!

        let timeline = Timeline(entries: [entry], policy: .after(refreshDate))
        completion(timeline)
    }

    /// Load widget data from shared App Group storage
    /// This is the ONLY data source for the widget - no API calls
    private func loadWidgetData() -> WidgetData {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            print("❌ [Widget] Failed to access App Group")
            return WidgetData.placeholder
        }

        guard let jsonString = userDefaults.string(forKey: "widgetData") else {
            print("❌ [Widget] No data found - open app to sync")
            return WidgetData.placeholder
        }

        guard let jsonData = jsonString.data(using: .utf8) else {
            print("❌ [Widget] Failed to convert JSON string to data")
            return WidgetData.placeholder
        }

        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let data = try decoder.decode(WidgetData.self, from: jsonData)
            return data
        } catch {
            print("❌ [Widget] Failed to decode data: \(error)")
            return WidgetData.placeholder
        }
    }
}

/// Timeline entry containing widget data
struct WidgetEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

/// Preview provider for widget
struct StackTrackerWidget_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            StackTrackerWidgetEntryView(entry: WidgetEntry(
                date: Date(),
                data: WidgetData.preview
            ))
            .previewContext(WidgetPreviewContext(family: .systemSmall))

            StackTrackerWidgetEntryView(entry: WidgetEntry(
                date: Date(),
                data: WidgetData.preview
            ))
            .previewContext(WidgetPreviewContext(family: .systemMedium))
        }
    }
}
