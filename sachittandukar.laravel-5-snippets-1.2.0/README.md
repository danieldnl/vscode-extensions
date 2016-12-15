# Laravel 5 snippets

This extension is made to help Laravel developers to code on Visual Studio Code. 

## Credit

This extension is based on sublime text extension for Laravel 5. So, huge credit goes to [https://github.com/Lykegenes/laravel-5-snippets](https://github.com/Lykegenes/laravel-5-snippets)

## Usage
The included snippets are organized in categories following Laravel's Facades and their documentation; such as `Auth::`, `Config::` and `Session::`.

All the snippets in this package follow the following naming convention : `{category}::{function name}`. For example : `Auth::check` will produce this snippet in your code : `Auth::check()`.

Also, snippets for HTML and Form Builders for the Laravel Framework is supported based on [https://github.com/LaravelCollective/html](https://github.com/LaravelCollective/html)

## Included snippets
Here are the available snippet categories and prefixes :

Prefix      | Notes
----------- | -------------
Auth  |
Blade  | Add `, text.html` to the default value of `"auto_complete_selector"` in your Sublime Text settings to allow Snippets autocomplete in Blade files.
Cache  |
Config  |
Console  |
Cookie  |
Crypt  |
DB  | To create raw database queries and transactions.
Event  |
Form|
Hash  |
Helper  | Contains sub-categories : `Helper::array`, `Helper::misc`, `Helper::path`, `Helper::strings`, and `Helper::url`; just like in [Laravel's documentation](http://laravel.com/docs/5.1/helpers#available-methods).
Input  |
Log  |
Mail |
Redirect  |
Relation | To create model relationships.
Response  |
Route  |
Schema  | Contains two sub-categories : `Schema::` for snippets related to the database table itself; and `Column::` for snippets related to the columns.
Session  |
Storage  |
View  |

## Release Notes

If there is any issue, please reach out to me on my twitter account. [https://twitter.com/sachittandukar](https://twitter.com/sachittandukar)

### 1.2.0

Added snippets support for Auth:attempt(), Auth:guard(), Auth:viaRemember() and Auth::loginUsingId()

### 1.1.0

Added snippets support for URL generators: link_to, link_to_asset, link_to_route, link_to_action.

### 1.0.0

Initial release

**Enjoy!**