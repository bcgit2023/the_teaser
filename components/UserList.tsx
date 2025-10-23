'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit, Trash } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"

type UserData = {
  id: number;
  username: string;
  role: 'student' | 'admin';
  grade?: number | null;
  age?: number | null;
}

export default function UserList() {
  const [users, setUsers] = useState<UserData[]>([])
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/users')
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({ title: "Error", description: "Failed to fetch users", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditUser = (user: UserData) => {
    setEditingUser(user)
  }

  const handleUpdateUser = async () => {
    if (!editingUser) return

    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser)
      })

      if (!response.ok) throw new Error('Failed to update user')

      setUsers(users.map(u => u.id === editingUser.id ? editingUser : u))
      setEditingUser(null)
      toast({ title: "Success", description: "User updated successfully" })
    } catch (error) {
      console.error('Error updating user:', error)
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" })
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete user')

      setUsers(users.filter(u => u.id !== userId))
      toast({ title: "Success", description: "User deleted successfully" })
    } catch (error) {
      console.error('Error deleting user:', error)
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" })
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading users...</div>
  }

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-[#0066CC]">User List</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {users.map(user => (
            <div key={user.id} className="flex items-center justify-between bg-gray-100 p-2 rounded">
              <div>
                <span className="font-semibold">{user.username}</span>
                <span className="ml-2 text-sm text-gray-600">({user.role})</span>
                {user.role === 'student' && (
                  <span className="ml-2 text-sm text-gray-600">Grade: {user.grade}, Age: {user.age}</span>
                )}
              </div>
              <div>
                <Button variant="ghost" onClick={() => handleEditUser(user)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => handleDeleteUser(user.id)}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <Card className="w-96 bg-white">
            <CardHeader>
              <CardTitle>Edit User</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-username">Username</Label>
                  <Input
                    id="edit-username"
                    value={editingUser.username}
                    onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-role">Role</Label>
                  <Select
                    value={editingUser.role}
                    onValueChange={(value: 'student' | 'admin') => setEditingUser({...editingUser, role: value})}
                  >
                    <SelectTrigger id="edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingUser.role === 'student' && (
                  <>
                    <div>
                      <Label htmlFor="edit-grade">Grade</Label>
                      <Input
                        id="edit-grade"
                        value={editingUser.grade?.toString() || ''}
                        onChange={(e) => setEditingUser({...editingUser, grade: parseInt(e.target.value) || null})}
                        type="number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-age">Age</Label>
                      <Input
                        id="edit-age"
                        value={editingUser.age?.toString() || ''}
                        onChange={(e) => setEditingUser({...editingUser, age: parseInt(e.target.value) || null})}
                        type="number"
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
            <div className="flex justify-end p-4">
              <Button variant="outline" onClick={() => setEditingUser(null)} className="mr-2">
                Cancel
              </Button>
              <Button onClick={handleUpdateUser}>
                Update User
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  )
}