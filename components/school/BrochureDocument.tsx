import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import React from "react";

const BADGE_COLORS = ["#4a80f0", "#f59e0b", "#10b981", "#8b5cf6", "#f97316", "#06b6d4", "#ec4899"];

const styles = StyleSheet.create({
  page:             { paddingTop: 0, paddingBottom: 52, paddingLeft: 0, paddingRight: 0, fontFamily: "Helvetica", backgroundColor: "#ffffff" },
  coverStrip:       { backgroundColor: "#1a1a1f", paddingTop: 36, paddingBottom: 36, paddingLeft: 48, paddingRight: 48, marginBottom: 32 },
  coverEyebrow:     { fontSize: 8, color: "#9090a8", letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica", marginBottom: 8 },
  coverTitle:       { fontSize: 26, color: "#ffffff", fontFamily: "Helvetica-Bold", letterSpacing: -0.5, marginBottom: 6 },
  coverSub:         { fontSize: 12, color: "#c0c0d0" },
  coverDate:        { fontSize: 9,  color: "#666675", marginTop: 10 },
  body:             { paddingLeft: 48, paddingRight: 48 },
  statsRow:         { flexDirection: "row", marginBottom: 32 },
  statBox:          { flex: 1, borderLeftWidth: 3, borderLeftColor: "#4a80f0", borderLeftStyle: "solid", paddingLeft: 12, marginRight: 20 },
  statBoxLast:      { flex: 1, borderLeftWidth: 3, borderLeftColor: "#10b981", borderLeftStyle: "solid", paddingLeft: 12 },
  statNum:          { fontSize: 30, color: "#1a1a1f", fontFamily: "Helvetica-Bold", letterSpacing: -1 },
  statLabel:        { fontSize: 8, color: "#9090a8", marginTop: 3, textTransform: "uppercase", letterSpacing: 1 },
  sectionLabel:     { fontSize: 8, color: "#4a80f0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, fontFamily: "Helvetica-Bold" },
  divider:          { borderBottomWidth: 1, borderBottomColor: "#f0f0f5", borderBottomStyle: "solid", marginBottom: 12 },
  tableHead:        { flexDirection: "row", paddingBottom: 8, marginBottom: 2, borderBottomWidth: 1, borderBottomColor: "#e5e5ea", borderBottomStyle: "solid" },
  tableRow:         { flexDirection: "row", paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#f5f5f8", borderBottomStyle: "solid", alignItems: "center" },
  tableRowAlt:      { flexDirection: "row", paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#f5f5f8", borderBottomStyle: "solid", alignItems: "center", backgroundColor: "#fafafa" },
  colName:          { width: "28%", fontSize: 10, color: "#1a1a1f", fontFamily: "Helvetica-Bold" },
  colCollege:       { width: "38%", fontSize: 10, color: "#1a1a1f", flexDirection: "row", alignItems: "center" },
  colRole:          { width: "34%", fontSize: 10, color: "#58586a" },
  colNameH:         { width: "28%", fontSize: 8, color: "#9090a8", textTransform: "uppercase", letterSpacing: 0.5 },
  colCollegeH:      { width: "38%", fontSize: 8, color: "#9090a8", textTransform: "uppercase", letterSpacing: 0.5 },
  colRoleH:         { width: "34%", fontSize: 8, color: "#9090a8", textTransform: "uppercase", letterSpacing: 0.5 },
  badge:            { width: 20, height: 20, borderRadius: 4, marginRight: 7, alignItems: "center", justifyContent: "center" },
  badgeText:        { fontSize: 9, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  logoImg:          { width: 20, height: 20, marginRight: 7, objectFit: "contain" },
  sectionGap:       { marginTop: 28 },
  testimonialWrap:  { marginBottom: 16 },
  testimonialInner: { paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: "#f59e0b", borderLeftStyle: "solid" },
  testimonialText:  { fontSize: 11, color: "#2a2a33", fontFamily: "Helvetica-Oblique", lineHeight: 1.6, marginBottom: 4 },
  testimonialSrc:   { fontSize: 8, color: "#9090a8", fontFamily: "Helvetica", textTransform: "uppercase", letterSpacing: 0.5 },
  footer:           { position: "absolute", bottom: 20, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText:       { fontSize: 8, color: "#c0c0c8" },
  footerPage:       { fontSize: 8, color: "#9090a8" },
});

export interface StudentRow {
  name: string; college: string | null;
  jobTitle: string | null; employer: string | null;
  internshipTitle: string | null; internshipOrg: string | null;
}

export interface Testimonial {
  body: string; sourceName: string; sourceContext: string | null;
}

export interface BrochureData {
  schoolName: string; generatedAt: string;
  totalStudents: number; collegesCount: number; jobsCount: number;
  students: StudentRow[]; testimonials: Testimonial[];
  logoMap: Record<string, string | null>;
}

export function BrochureDocument({ data }: { data: BrochureData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.coverStrip}>
          <Text style={styles.coverEyebrow}>Student Outcomes Report</Text>
          <Text style={styles.coverTitle}>Nivarro × {data.schoolName}</Text>
          <Text style={styles.coverSub}>Real outcomes. Real students.</Text>
          <Text style={styles.coverDate}>Generated {data.generatedAt}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{data.totalStudents}</Text>
              <Text style={styles.statLabel}>Students Featured</Text>
            </View>
            <View style={[styles.statBox, { borderLeftColor: "#f59e0b" }]}>
              <Text style={styles.statNum}>{data.collegesCount}</Text>
              <Text style={styles.statLabel}>Colleges</Text>
            </View>
            <View style={styles.statBoxLast}>
              <Text style={styles.statNum}>{data.jobsCount}</Text>
              <Text style={styles.statLabel}>Jobs / Internships</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Student Outcomes</Text>
          <View style={styles.divider} />
          <View style={styles.tableHead}>
            <Text style={styles.colNameH}>Name</Text>
            <Text style={styles.colCollegeH}>College</Text>
            <Text style={styles.colRoleH}>Role / Employer</Text>
          </View>
          {data.students.map((s, i) => {
            const logo = s.college ? data.logoMap[s.college] : null;
            const initial = s.college ? s.college.charAt(0).toUpperCase() : "?";
            const badgeColor = BADGE_COLORS[i % BADGE_COLORS.length];
            const role = s.jobTitle && s.employer
              ? `${s.jobTitle} @ ${s.employer}`
              : s.internshipTitle && s.internshipOrg
              ? `${s.internshipTitle} @ ${s.internshipOrg}`
              : "—";
            return (
              <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.colName}>{s.name}</Text>
                <View style={styles.colCollege}>
                  {logo
                    ? <Image style={styles.logoImg} src={logo} />
                    : (
                      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.badgeText}>{initial}</Text>
                      </View>
                    )}
                  <Text style={{ fontSize: 10, color: "#1a1a1f" }}>{s.college ?? "—"}</Text>
                </View>
                <Text style={styles.colRole}>{role}</Text>
              </View>
            );
          })}

          {data.testimonials.length > 0 && (
            <View style={styles.sectionGap}>
              <Text style={styles.sectionLabel}>What They Say</Text>
              <View style={styles.divider} />
              {data.testimonials.map((t, i) => (
                <View key={i} style={styles.testimonialWrap}>
                  <View style={styles.testimonialInner}>
                    <Text style={styles.testimonialText}>&quot;{t.body}&quot;</Text>
                    <Text style={styles.testimonialSrc}>
                      — {t.sourceName}{t.sourceContext ? ` · ${t.sourceContext}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Powered by Nivarro · app.nivarro.co</Text>
          <Text style={styles.footerPage} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
