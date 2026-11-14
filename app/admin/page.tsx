"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  MessageSquare,
  HardDrive,
  ShieldAlert,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Edit,
  Trash2,
  Building,
  Activity,
  PhoneCall,
  Lock,
  Layers,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, RoleBadge } from "@/components/ui/Badge";
import { formatFileSize, formatLastSeen } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StorageDashboard } from "@/components/admin/StorageDashboard";
import { WhatsAppConnectionManager } from "@/components/admin/WhatsAppConnectionManager";

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "WHATSAPP" | "STORAGE" | "EMPLOYEES" | "GROUPS" | "DEPARTMENTS" | "AUDIT">("OVERVIEW");
  const [stats, setStats] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Modals
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("ALL");
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");

  // Add Employee Form State
  const [newEmpData, setNewEmpData] = useState({
    username: "",
    displayName: "",
    email: "",
    phone: "",
    password: "",
    designation: "",
    department: "",
    role: "EMPLOYEE",
  });

  // Access check
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN" && user.role !== "MANAGER") {
        router.push("/chat");
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, convRes, deptRes, auditRes] = await Promise.all([
        fetch("/api/admin/stats").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/conversations").then((r) => r.json()),
        fetch("/api/admin/departments").then((r) => r.json()),
        fetch("/api/admin/audit").then((r) => r.json()),
      ]);

      if (statsRes.metrics) setStats(statsRes);
      if (usersRes.users) setEmployees(usersRes.users);
      if (convRes.conversations) setGroups(convRes.conversations.filter((c: any) => c.isGroup));
      if (deptRes.departments) setDepartments(deptRes.departments);
      if (auditRes.logs) setAuditLogs(auditRes.logs);
    } catch (err) {
      console.error("Admin load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Add Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmpData),
      });

      if (res.ok) {
        setShowAddEmployeeModal(false);
        setNewEmpData({
          username: "",
          displayName: "",
          email: "",
          phone: "",
          password: "",
          designation: "",
          department: "",
          role: "EMPLOYEE",
        });
        loadAllAdminData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create employee");
      }
    } catch (e) {
      alert("Error creating employee");
    }
  };

  // Update Employee
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      const res = await fetch(`/api/users/${editingEmployee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editingEmployee.displayName,
          designation: editingEmployee.designation,
          department: editingEmployee.department,
          role: editingEmployee.role,
          status: editingEmployee.status,
          password: editingEmployee.newPassword || undefined,
        }),
      });

      if (res.ok) {
        setShowEditEmployeeModal(false);
        setEditingEmployee(null);
        loadAllAdminData();
      }
    } catch (e) {
      alert("Error updating employee");
    }
  };

  // Suspend / Activate Employee
  const handleToggleStatus = async (emp: any) => {
    const nextStatus = emp.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await fetch(`/api/users/${emp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      loadAllAdminData();
    } catch (e) {}
  };

  // Delete / Remove Employee
  const handleDeleteEmployee = async (emp: any) => {
    if (emp.role === "SUPER_ADMIN" || emp.username === "admin") {
      alert("Cannot delete the Super Administrator account.");
      return;
    }

    if (!confirm(`Are you sure you want to permanently remove employee "${emp.displayName}" (@${emp.username})?\n\nThis will remove their profile and chat memberships.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${emp.id}`, { method: "DELETE" });
      if (res.ok) {
        setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
        loadAllAdminData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to remove employee");
      }
    } catch (e) {
      alert("Error removing employee");
    }
  };

  // Add Department
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;

    try {
      const res = await fetch("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeptName.trim(), description: newDeptDesc.trim() }),
      });

      if (res.ok) {
        setShowAddDeptModal(false);
        setNewDeptName("");
        setNewDeptDesc("");
        loadAllAdminData();
      }
    } catch (e) {}
  };

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    if (selectedDeptFilter !== "ALL" && emp.department !== selectedDeptFilter) return false;
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    return (
      emp.displayName.toLowerCase().includes(q) ||
      emp.username.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      emp.phone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-chat-darkBg text-neutral-900 dark:text-neutral-100 select-none">
      {/* Top Navbar */}
      <header className="bg-white dark:bg-chat-darkPanel border-b border-neutral-200 dark:border-chat-darkBorder sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/chat"
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
            title="Return to Chat"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-brand-900 dark:text-emerald-400">
                ConnectPro Admin Console
              </h1>
              <Badge variant="primary">Enterprise</Badge>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Company Communication & Workforce Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Avatar src={user?.avatar} name={user?.displayName || "Admin"} size="sm" isOnline={true} />
          <div className="text-right hidden sm:block">
            <span className="text-xs font-semibold block">{user?.displayName}</span>
            <RoleBadge role={user?.role || "ADMIN"} />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-neutral-200 dark:border-chat-darkBorder pb-3 mb-6 overflow-x-auto">
          {[
            { id: "OVERVIEW", label: "Overview & Metrics", icon: Activity },
            { id: "WHATSAPP", label: "WhatsApp Connection", icon: MessageSquare, badge: "Meta Coex" },
            { id: "STORAGE", label: "Storage & Retention", icon: HardDrive },
            { id: "EMPLOYEES", label: "Employee Directory", icon: Users },
            { id: "GROUPS", label: "Company Groups", icon: Layers },
            { id: "DEPARTMENTS", label: "Departments", icon: Building },
            { id: "AUDIT", label: "Security & Audit Logs", icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-brand-600 text-white shadow-xs"
                    : "bg-white dark:bg-chat-darkPanel text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {(tab as any).badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? "bg-white/25 text-white" : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {(tab as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB: WHATSAPP CONNECTION & COEXISTENCE */}
        {activeTab === "WHATSAPP" && <WhatsAppConnectionManager />}

        {/* TAB 1: OVERVIEW & METRICS */}
        {activeTab === "OVERVIEW" && stats && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-chat-darkPanel p-5 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">Total Employees</span>
                  <div className="p-2 rounded-xl bg-brand-50 text-brand-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold mt-2">{stats.metrics.totalEmployees}</div>
                <div className="text-[11px] text-emerald-600 mt-1 font-medium">
                  {stats.metrics.activeEmployees} active accounts
                </div>
              </div>

              <div className="bg-white dark:bg-chat-darkPanel p-5 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">Active Groups</span>
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold mt-2">{stats.metrics.totalGroups}</div>
                <div className="text-[11px] text-neutral-500 mt-1 font-medium">Department channels</div>
              </div>

              <div className="bg-white dark:bg-chat-darkPanel p-5 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">Messages Delivered</span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold mt-2">{stats.metrics.totalMessages}</div>
                <div className="text-[11px] text-blue-600 mt-1 font-medium">End-to-end encrypted</div>
              </div>

              <div className="bg-white dark:bg-chat-darkPanel p-5 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500">Media Storage</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                    <HardDrive className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold mt-2">
                  {formatFileSize(stats.metrics.totalStorageBytes)}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1 font-medium">Docs, audio, images</div>
              </div>
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Department Breakdown */}
              <div className="bg-white dark:bg-chat-darkPanel p-5 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Building className="w-4 h-4 text-brand-600" /> Employees by Department
                </h3>
                <div className="space-y-3">
                  {stats.distribution.byDepartment.map((d: any) => (
                    <div key={d.department} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>{d.department}</span>
                        <span>{d.count} employees</span>
                      </div>
                      <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-brand-600 dark:bg-emerald-500 h-full rounded-full"
                          style={{
                            width: `${(d.count / (stats.metrics.totalEmployees || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message Types Breakdown */}
              <div className="bg-white dark:bg-chat-darkPanel p-5 rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-brand-600" /> Communication Distribution
                </h3>
                <div className="space-y-3">
                  {stats.distribution.byMessageType.map((m: any) => (
                    <div key={m.type} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>{m.type} messages</span>
                        <span>{m.count} sent</span>
                      </div>
                      <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full"
                          style={{
                            width: `${(m.count / (stats.metrics.totalMessages || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EMPLOYEE DIRECTORY */}
        {activeTab === "EMPLOYEES" && (
          <div className="bg-white dark:bg-chat-darkPanel rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs overflow-hidden animate-in fade-in duration-150">
            {/* Table Action Bar */}
            <div className="p-4 border-b border-neutral-200 dark:border-chat-darkBorder flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search employees..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn border-transparent rounded-xl focus:outline-hidden"
                  />
                </div>

                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  className="text-xs py-2 px-3 bg-neutral-100 dark:bg-chat-darkIn border border-neutral-200 dark:border-chat-darkBorder rounded-xl focus:outline-hidden"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setShowAddEmployeeModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Employee
              </button>
            </div>

            {/* Employee Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-chat-darkIn border-b border-neutral-200 dark:border-chat-darkBorder text-neutral-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Department & Designation</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-chat-darkBorder">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar src={emp.avatar} name={emp.displayName} size="sm" isOnline={emp.isOnline} />
                          <div>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                              {emp.displayName}
                            </span>
                            <span className="text-[11px] text-neutral-400">@{emp.username}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <RoleBadge role={emp.role} />
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium block text-neutral-800 dark:text-neutral-200">
                          {emp.designation || "Staff"}
                        </span>
                        <span className="text-[11px] text-neutral-500">{emp.department || "Enterprise"}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="block text-neutral-700 dark:text-neutral-300">{emp.email}</span>
                        <span className="text-[11px] text-neutral-400">{emp.phone}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        {emp.status === "ACTIVE" ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="danger">Suspended</Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingEmployee({ ...emp });
                              setShowEditEmployeeModal(true);
                            }}
                            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-neutral-600 dark:text-neutral-300"
                            title="Edit Employee"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(emp)}
                            className={`p-1.5 rounded-lg text-xs font-semibold ${
                              emp.status === "ACTIVE"
                                ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            }`}
                            title={emp.status === "ACTIVE" ? "Suspend Employee" : "Reactivate Employee"}
                          >
                            {emp.status === "ACTIVE" ? (
                              <XCircle className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {emp.role !== "SUPER_ADMIN" && emp.username !== "admin" && (
                            <button
                              onClick={() => handleDeleteEmployee(emp)}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-rose-600 dark:text-rose-400 transition-colors"
                              title="Delete / Remove Employee Permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: COMPANY GROUPS */}
        {activeTab === "GROUPS" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-150">
            {groups.map((grp) => (
              <div
                key={grp.id}
                className="bg-white dark:bg-chat-darkPanel rounded-2xl border border-neutral-200 dark:border-chat-darkBorder p-5 flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar src={grp.avatar} name={grp.name} size="md" />
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                        {grp.name}
                      </h4>
                      <span className="text-[11px] text-neutral-500">
                        {grp.members?.length || 0} active members
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                    {grp.description || "Company team conversation channel."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-chat-darkBorder flex items-center justify-between text-xs">
                  <span className="text-[10px] text-neutral-400">
                    Last active {formatLastSeen(grp.lastMessageAt, false)}
                  </span>
                  <Link
                    href={`/chat?c=${grp.id}`}
                    className="text-brand-600 font-semibold hover:underline"
                  >
                    Open Chat →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: DEPARTMENTS */}
        {activeTab === "DEPARTMENTS" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Company Departments
                </h3>
                <p className="text-xs text-neutral-500">
                  Organize employee directories, permissions, and group routing.
                </p>
              </div>
              <button
                onClick={() => setShowAddDeptModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                <Plus className="w-4 h-4" /> Add Department
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="bg-white dark:bg-chat-darkPanel rounded-2xl border border-neutral-200 dark:border-chat-darkBorder p-5 shadow-xs"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="p-2 bg-brand-50 text-brand-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-xl">
                      <Building className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {dept.name}
                    </h4>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {dept.description || "Standard company operational department."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT LOGS */}
        {activeTab === "AUDIT" && (
          <div className="bg-white dark:bg-chat-darkPanel rounded-2xl border border-neutral-200 dark:border-chat-darkBorder shadow-xs overflow-hidden animate-in fade-in duration-150">
            <div className="p-4 border-b border-neutral-200 dark:border-chat-darkBorder flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Security & Audit Trail
                </h3>
                <p className="text-xs text-neutral-500">
                  Real-time event logging of employee logins, profile modifications, and administrative operations.
                </p>
              </div>
              <Badge variant="success">SOC2 Compliant Log</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-chat-darkIn border-b border-neutral-200 dark:border-chat-darkBorder text-neutral-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-chat-darkBorder font-mono text-[11px]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40">
                      <td className="py-3 px-4 text-neutral-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-brand-700 dark:text-emerald-400">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 font-sans text-neutral-800 dark:text-neutral-200">
                        {log.user?.displayName || "System"}
                      </td>
                      <td className="py-3 px-4 font-sans text-neutral-600 dark:text-neutral-400">
                        {log.details || "-"}
                      </td>
                      <td className="py-3 px-4 text-neutral-400">{log.ipAddress || "127.0.0.1"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: STORAGE MANAGEMENT & DATA RETENTION */}
        {activeTab === "STORAGE" && <StorageDashboard />}
      </div>

      {/* MODAL: ADD EMPLOYEE */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder rounded-3xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Add New Employee Account
            </h3>
            <form onSubmit={handleAddEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmpData.displayName}
                    onChange={(e) => setNewEmpData({ ...newEmpData, displayName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmpData.username}
                    onChange={(e) => setNewEmpData({ ...newEmpData, username: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                    placeholder="e.g. john.doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmpData.email}
                    onChange={(e) => setNewEmpData({ ...newEmpData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                    placeholder="john.doe@connectpro.internal"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newEmpData.phone}
                    onChange={(e) => setNewEmpData({ ...newEmpData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                    placeholder="+1-555-0199"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={newEmpData.password}
                    onChange={(e) => setNewEmpData({ ...newEmpData, password: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Role *
                  </label>
                  <select
                    value={newEmpData.role}
                    onChange={(e) => setNewEmpData({ ...newEmpData, role: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={newEmpData.designation}
                    onChange={(e) => setNewEmpData({ ...newEmpData, designation: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Department
                  </label>
                  <select
                    value={newEmpData.department}
                    onChange={(e) => setNewEmpData({ ...newEmpData, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                  >
                    <option value="">Select department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-chat-darkBorder">
                <button
                  type="button"
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-xs"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT EMPLOYEE */}
      {showEditEmployeeModal && editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Edit Employee: {editingEmployee.displayName}
            </h3>
            <form onSubmit={handleUpdateEmployee} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editingEmployee.displayName}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, displayName: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.designation || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, designation: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Department
                  </label>
                  <select
                    value={editingEmployee.department || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Role
                  </label>
                  <select
                    value={editingEmployee.role}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editingEmployee.status}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                  Reset Password (Leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editingEmployee.newPassword || ""}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, newPassword: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                  placeholder="New password..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-chat-darkBorder">
                <button
                  type="button"
                  onClick={() => setShowEditEmployeeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD DEPARTMENT */}
      {showAddDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-chat-darkPanel border border-neutral-200 dark:border-chat-darkBorder rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Add New Department
            </h3>
            <form onSubmit={handleAddDepartment} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                  placeholder="e.g. Legal & Compliance"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newDeptDesc}
                  onChange={(e) => setNewDeptDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-100 dark:bg-chat-darkIn rounded-xl border border-neutral-200 dark:border-chat-darkBorder focus:outline-hidden"
                  placeholder="Department scope and responsibilities"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-chat-darkBorder">
                <button
                  type="button"
                  onClick={() => setShowAddDeptModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-xs"
                >
                  Add Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
