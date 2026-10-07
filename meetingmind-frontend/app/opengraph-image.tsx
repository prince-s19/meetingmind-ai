import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: "#f5f2e8",
          color: "#181817",
          fontFamily: '"DM Sans", "Segoe UI", Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: "100%",
            height: 46,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#07594d",
            color: "#fffef5",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          MeetingMind turns transcripts into tasks you can actually trust.
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: 820,
              height: 74,
              padding: "0 20px 0 18px",
              borderRadius: 18,
              border: "1px solid rgba(24, 24, 23, 0.15)",
              background: "rgba(255, 255, 255, 0.72)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 2, height: 18 }}>
                {[8, 13, 18, 13, 8].map((height, index) => (
                  <div
                    key={index}
                    style={{
                      width: 3,
                      height,
                      borderRadius: 4,
                      background: "#181817",
                      opacity: index === 2 ? 1 : 0.92,
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.06em" }}>MeetingMind AI</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 14, color: "#181817" }}>
              <div>How it works</div>
              <div>Privacy</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 38,
                  padding: "0 18px",
                  borderRadius: 999,
                  background: "#181817",
                  color: "#f5f2e8",
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                }}
              >
                Get started
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            flex: 1,
            paddingBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#6c6a62",
              letterSpacing: "0.11em",
              marginBottom: 12,
            }}
          >
            MEETING INTELLIGENCE, MADE HUMAN
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: 124,
              lineHeight: 0.9,
              letterSpacing: "-0.075em",
              fontWeight: 400,
              maxWidth: 1060,
            }}
          >
            <div>Turn meetings transcript</div>
            <div style={{ fontStyle: "italic" }}>into action</div>
          </div>

          <div
            style={{
              marginTop: 18,
              fontSize: 29,
              color: "rgba(24,24,23,0.82)",
              letterSpacing: "-0.04em",
              lineHeight: 1.25,
              maxWidth: 760,
            }}
          >
            AI-powered meeting transcripts converted to actionable tasks in seconds.
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
