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
struct Provider: TimelineProvider {
    private let appGroupId = "group.com.stacktrackerpro.shared"
    private let apiBaseUrl = "https://stack-tracker-pro-production.up.railway.app"

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

        // Load existing data from App Group
        var data = loadWidgetData()

        // Check if data is stale (older than 10 minutes)
        let dataAge = currentDate.timeIntervalSince(data.lastUpdated)
        let isStale = dataAge > 600 // 10 minutes

        print("🔧 [Widget] Timeline refresh - data age: \(Int(dataAge))s, isStale: \(isStale)")

        if isStale && data.hasSubscription {
            // Fetch fresh prices from backend
            fetchSpotPrices { freshPrices in
                if let prices = freshPrices {
                    // Update spot prices in the data
                    var updatedData = data
                    updatedData.goldSpot = prices.gold
                    updatedData.silverSpot = prices.silver
                    updatedData.goldChangeAmount = prices.goldChange
                    updatedData.goldChangePercent = prices.goldChangePercent
                    updatedData.silverChangeAmount = prices.silverChange
                    updatedData.silverChangePercent = prices.silverChangePercent
                    updatedData.lastUpdated = Date()

                    // Recalculate portfolio value with fresh prices
                    // (portfolioValue stays the same - we'd need holdings data to recalculate)

                    // Save updated data back to App Group
                    saveWidgetData(updatedData)

                    print("✅ [Widget] Updated with fresh prices - Gold: $\(prices.gold), Silver: $\(prices.silver)")

                    let entry = WidgetEntry(date: currentDate, data: updatedData)
                    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate)!
                    let timeline = Timeline(entries: [entry], policy: .after(refreshDate))
                    completion(timeline)
                } else {
                    // Failed to fetch, use existing data
                    print("⚠️ [Widget] Failed to fetch fresh prices, using cached data")
                    let entry = WidgetEntry(date: currentDate, data: data)
                    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate)!
                    let timeline = Timeline(entries: [entry], policy: .after(refreshDate))
                    completion(timeline)
                }
            }
        } else {
            // Data is fresh enough, use it directly
            let entry = WidgetEntry(date: currentDate, data: data)
            let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate)!
            let timeline = Timeline(entries: [entry], policy: .after(refreshDate))
            completion(timeline)
        }
    }

    /// Fetch spot prices from backend API
    private func fetchSpotPrices(completion: @escaping (SpotPrices?) -> Void) {
        guard let url = URL(string: "\(apiBaseUrl)/api/spot-prices") else {
            print("❌ [Widget] Invalid API URL")
            completion(nil)
            return
        }

        print("🔧 [Widget] Fetching prices from: \(url)")

        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                print("❌ [Widget] Network error: \(error.localizedDescription)")
                completion(nil)
                return
            }

            guard let data = data else {
                print("❌ [Widget] No data received")
                completion(nil)
                return
            }

            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let success = json["success"] as? Bool, success,
                   let gold = json["gold"] as? Double,
                   let silver = json["silver"] as? Double {

                    var goldChange: Double = 0
                    var goldChangePercent: Double = 0
                    var silverChange: Double = 0
                    var silverChangePercent: Double = 0

                    if let change = json["change"] as? [String: Any] {
                        if let goldData = change["gold"] as? [String: Any] {
                            goldChange = goldData["amount"] as? Double ?? 0
                            goldChangePercent = goldData["percent"] as? Double ?? 0
                        }
                        if let silverData = change["silver"] as? [String: Any] {
                            silverChange = silverData["amount"] as? Double ?? 0
                            silverChangePercent = silverData["percent"] as? Double ?? 0
                        }
                    }

                    let prices = SpotPrices(
                        gold: gold,
                        silver: silver,
                        goldChange: goldChange,
                        goldChangePercent: goldChangePercent,
                        silverChange: silverChange,
                        silverChangePercent: silverChangePercent
                    )
                    print("✅ [Widget] Parsed prices - Gold: $\(gold), Silver: $\(silver)")
                    completion(prices)
                } else {
                    print("❌ [Widget] Failed to parse JSON response")
                    completion(nil)
                }
            } catch {
                print("❌ [Widget] JSON parsing error: \(error.localizedDescription)")
                completion(nil)
            }
        }
        task.resume()
    }

    /// Save widget data to App Group storage
    private func saveWidgetData(_ data: WidgetData) {
        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            print("❌ [Widget] Failed to access App Group for saving")
            return
        }

        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let jsonData = try encoder.encode(data)
            if let jsonString = String(data: jsonData, encoding: .utf8) {
                userDefaults.set(jsonString, forKey: "widgetData")
                print("✅ [Widget] Saved updated data to App Group")
            }
        } catch {
            print("❌ [Widget] Failed to encode data for saving: \(error)")
        }
    }

    /// Load widget data from shared App Group storage
    private func loadWidgetData() -> WidgetData {
        print("🔧 [Widget] loadWidgetData called")

        guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
            print("❌ [Widget] Failed to access App Group")
            return WidgetData.placeholder
        }

        guard let jsonString = userDefaults.string(forKey: "widgetData") else {
            print("❌ [Widget] No data found for key 'widgetData'")
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
            print("✅ [Widget] Loaded data - hasSubscription: \(data.hasSubscription), portfolioValue: \(data.portfolioValue)")
            return data
        } catch {
            print("❌ [Widget] Failed to decode data: \(error)")
            return WidgetData.placeholder
        }
    }
}

/// Simple struct for spot prices from API
struct SpotPrices {
    let gold: Double
    let silver: Double
    let goldChange: Double
    let goldChangePercent: Double
    let silverChange: Double
    let silverChangePercent: Double
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
