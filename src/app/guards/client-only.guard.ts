import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable, from } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { UsersService } from '../services/users.service';

@Injectable({
  providedIn: 'root',
})
export class ClientOnlyGuard {
  constructor(private router: Router, private usersService: UsersService) {}

  canActivate(
    _next: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    const uid = JSON.parse(localStorage.getItem('user') || '{}')?.uid;

    if (!uid) {
      return new Observable(observer => {
        observer.next(this.router.createUrlTree(['/messages']));
        observer.complete();
      });
    }

    return this.usersService.getUserById(uid).pipe(
      take(1),
      map((user: any) => {
        const role = `${user?.role ?? ''}`.toLowerCase();
        return role === 'counsellor'
          ? this.router.createUrlTree(['/messages'])
          : true;
      })
    );
  }
}
