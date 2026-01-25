import SwiftUI
import WidgetKit

/// Main widget entry view that switches between sizes
struct StackTrackerWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: WidgetEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(data: entry.data)
        case .systemMedium:
            MediumWidgetView(data: entry.data)
        default:
            SmallWidgetView(data: entry.data)
        }
    }
}

// MARK: - Small Widget View

struct SmallWidgetView: View {
    let data: WidgetData

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if data.hasSubscription {
                // Portfolio Label
                Text("Portfolio")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(Color(hex: "#71717a"))

                // Portfolio Value - LARGE and prominent
                Text(formatCurrency(data.portfolioValue))
                    .font(.system(size: 34, weight: .bold))
                    .foregroundColor(.white)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)

                // Daily Change
                HStack(spacing: 3) {
                    Text(data.dailyChangeAmount >= 0 ? "▲" : "▼")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(portfolioChangeColor)

                    Text(formatChange(data.dailyChangeAmount))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(portfolioChangeColor)

                    Text("(\(formatPercent(data.dailyChangePercent)))")
                        .font(.system(size: 11))
                        .foregroundColor(portfolioChangeColor)
                }

                Spacer()

                // Branding and timestamp at bottom
                HStack {
                    Text("Stack Tracker Gold")
                        .font(.system(size: 7, weight: .medium))
                        .foregroundColor(Color(hex: "#fbbf24").opacity(0.7))
                        .lineLimit(1)
                    Spacer()
                    Text(timeAgoString)
                        .font(.system(size: 7))
                        .foregroundColor(Color(hex: "#71717a"))
                }
            } else {
                // Not subscribed message
                Spacer()
                VStack(spacing: 4) {
                    Text("Upgrade to Gold")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color(hex: "#fbbf24"))
                    Text("for widget access")
                        .font(.system(size: 11))
                        .foregroundColor(Color(hex: "#71717a"))
                }
                Spacer()
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
            Color(hex: "#1a1a2e")
        }
    }

    private var portfolioChangeColor: Color {
        data.dailyChangeAmount >= 0 ? Color(hex: "#22c55e") : Color(hex: "#ef4444")
    }

    private var timeAgoString: String {
        let interval = Date().timeIntervalSince(data.lastUpdated)
        let minutes = Int(interval / 60)

        if minutes < 1 {
            return "Just now"
        } else if minutes == 1 {
            return "1m ago"
        } else if minutes < 60 {
            return "\(minutes)m ago"
        } else {
            let hours = minutes / 60
            return hours == 1 ? "1h ago" : "\(hours)h ago"
        }
    }
}

// MARK: - Medium Widget View

struct MediumWidgetView: View {
    let data: WidgetData

    var body: some View {
        Group {
            if data.hasSubscription {
                VStack(alignment: .leading, spacing: 0) {
                    // Portfolio section at top
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Portfolio")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(Color(hex: "#71717a"))
                            Text(formatCurrency(data.portfolioValue))
                                .font(.system(size: 52, weight: .bold))
                                .foregroundColor(.white)
                                .minimumScaleFactor(0.5)
                                .lineLimit(1)
                        }

                        Spacer()

                        // Daily Change
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("Today")
                                .font(.system(size: 10))
                                .foregroundColor(Color(hex: "#71717a"))
                            HStack(spacing: 3) {
                                Text(data.dailyChangeAmount >= 0 ? "▲" : "▼")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(portfolioChangeColor)
                                Text(formatChange(data.dailyChangeAmount))
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(portfolioChangeColor)
                            }
                            Text(formatPercent(data.dailyChangePercent))
                                .font(.system(size: 11))
                                .foregroundColor(portfolioChangeColor)
                        }
                        .padding(.top, 2)
                    }

                    Spacer()
                        .frame(minHeight: 8, maxHeight: 16)

                    // Spot Prices Row - LARGER with better spacing
                    HStack(alignment: .top, spacing: 40) {
                        // Gold
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Gold")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(Color(hex: "#fbbf24"))
                            Text(formatSpotPrice(data.goldSpot))
                                .font(.system(size: 22, weight: .bold))
                                .foregroundColor(.white)
                                .minimumScaleFactor(0.8)
                                .lineLimit(1)
                            HStack(spacing: 3) {
                                Text(data.goldChangeAmount >= 0 ? "▲" : "▼")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(goldChangeColor)
                                Text(formatSmallChange(data.goldChangeAmount))
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(goldChangeColor)
                            }
                        }

                        // Silver
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Silver")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(Color(hex: "#9ca3af"))
                            Text(formatSpotPrice(data.silverSpot))
                                .font(.system(size: 22, weight: .bold))
                                .foregroundColor(.white)
                                .minimumScaleFactor(0.8)
                                .lineLimit(1)
                            HStack(spacing: 3) {
                                Text(data.silverChangeAmount >= 0 ? "▲" : "▼")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(silverChangeColor)
                                Text(formatSmallChange(data.silverChangeAmount))
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(silverChangeColor)
                            }
                        }

                        Spacer()
                    }

                    Spacer()
                        .frame(minHeight: 4, maxHeight: 8)

                    // Branding and timestamp at bottom
                    HStack {
                        Text("Stack Tracker Gold")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundColor(Color(hex: "#fbbf24").opacity(0.7))
                        Spacer()
                        Text(timeAgoString)
                            .font(.system(size: 9))
                            .foregroundColor(Color(hex: "#71717a"))
                    }
                }
                .padding(12)
            } else {
                // Not subscribed
                VStack(spacing: 8) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 28))
                        .foregroundColor(Color(hex: "#71717a"))
                    Text("Upgrade to Gold")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(Color(hex: "#fbbf24"))
                    Text("Get portfolio widgets on your home screen")
                        .font(.system(size: 12))
                        .foregroundColor(Color(hex: "#71717a"))
                        .multilineTextAlignment(.center)
                }
                .padding()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
            Color(hex: "#1a1a2e")
        }
    }

    private var portfolioChangeColor: Color {
        data.dailyChangeAmount >= 0 ? Color(hex: "#22c55e") : Color(hex: "#ef4444")
    }

    private var goldChangeColor: Color {
        data.goldChangeAmount >= 0 ? Color(hex: "#22c55e") : Color(hex: "#ef4444")
    }

    private var silverChangeColor: Color {
        data.silverChangeAmount >= 0 ? Color(hex: "#22c55e") : Color(hex: "#ef4444")
    }

    private var timeAgoString: String {
        let interval = Date().timeIntervalSince(data.lastUpdated)
        let minutes = Int(interval / 60)

        if minutes < 1 {
            return "Just now"
        } else if minutes == 1 {
            return "1m ago"
        } else if minutes < 60 {
            return "\(minutes)m ago"
        } else {
            let hours = minutes / 60
            return hours == 1 ? "1h ago" : "\(hours)h ago"
        }
    }
}

// MARK: - Helper Functions

private func formatCurrency(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: value)) ?? "$0"
}

private func formatSpotPrice(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.minimumFractionDigits = 2
    formatter.maximumFractionDigits = 2
    return formatter.string(from: NSNumber(value: value)) ?? "$0.00"
}

private func formatChange(_ value: Double) -> String {
    let prefix = value >= 0 ? "+" : ""
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.maximumFractionDigits = 0
    return prefix + (formatter.string(from: NSNumber(value: value)) ?? "$0")
}

private func formatSmallChange(_ value: Double) -> String {
    let prefix = value >= 0 ? "+" : ""
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.minimumFractionDigits = 2
    formatter.maximumFractionDigits = 2
    return prefix + (formatter.string(from: NSNumber(value: abs(value))) ?? "$0.00")
}

private func formatPercent(_ value: Double) -> String {
    let prefix = value >= 0 ? "+" : ""
    return "\(prefix)\(String(format: "%.2f", value))%"
}

// MARK: - Color Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
